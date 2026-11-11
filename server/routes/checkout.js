import { Router } from "express";
import crypto from "crypto";
import { pool, HttpError } from "../db.js";
import { validarCompatibilidad } from "../compat.js";

const router = Router();
const METODOS = ["Tarjeta de crédito", "Tarjeta débito", "PSE", "Contraentrega"];
const MAX_ITEMS = 50;

// Pasarela SIMULADA. Aquí se integra Wompi / PayU / Mercado Pago.
// Nunca se reciben ni se guardan datos de tarjeta en este servidor.
async function procesarPago({ metodo }) {
  await new Promise((r) => setTimeout(r, 300));
  return { aprobado: true, referencia: `SIM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`, metodo };
}

function validarCliente(c = {}) {
  const nombre = String(c.nombre || "").trim();
  const correo = String(c.correo || "").trim().toLowerCase();
  const telefono = String(c.telefono || "").replace(/[\s()-]/g, "");
  const direccion = String(c.direccion || "").trim();
  if (nombre.length < 3 || nombre.length > 100) throw new HttpError(400, "Nombre inválido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150) throw new HttpError(400, "Correo inválido.");
  if (!/^\+?\d{7,15}$/.test(telefono)) throw new HttpError(400, "Teléfono inválido.");
  if (direccion.length < 5 || direccion.length > 200) throw new HttpError(400, "Dirección inválida.");
  return {
    nombre, correo, telefono, direccion,
    documento: String(c.documento || "").trim().slice(0, 20) || null,
    ciudad: String(c.ciudad || "").trim().slice(0, 50) || null,
  };
}

router.post("/checkout", async (req, res, next) => {
  let conn;
  try {
    const { cliente, items, metodo_pago } = req.body || {};
    const cli = validarCliente(cliente);
    if (!METODOS.includes(metodo_pago)) throw new HttpError(400, `Método de pago inválido (${METODOS.join(", ")}).`);
    if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS) throw new HttpError(400, "El carrito está vacío o es demasiado grande.");

    // Agrupar cantidades por producto (la PK de DETALLE_PEDIDO es (pedido, producto))
    const qty = new Map();
    for (const it of items) {
      const id = Number(it.id);
      const n = Number(it.cantidad);
      if (!Number.isInteger(id) || !Number.isInteger(n) || n < 1 || n > 20) throw new HttpError(400, "Ítem inválido en el carrito.");
      qty.set(id, (qty.get(id) || 0) + n);
    }
    const ids = [...qty.keys()].sort((a, b) => a - b);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Bloqueo de filas para que dos compras simultáneas no vendan el mismo stock
    const [prods] = await conn.query(
      `SELECT p.id_producto, p.nombre_producto, p.precio_unitario, p.stock_disponible, p.activo,
              p.socket_cpu, p.tipo_ram, c.slug AS categoria
       FROM PRODUCTO p JOIN CATEGORIA c ON c.id_categoria = p.id_categoria
       WHERE p.id_producto IN (?) ORDER BY p.id_producto FOR UPDATE`,
      [ids]
    );
    if (prods.length !== ids.length || prods.some((p) => !p.activo)) throw new HttpError(409, "Algún producto ya no está disponible.");

    const sinStock = prods.filter((p) => p.stock_disponible < qty.get(p.id_producto));
    if (sinStock.length) {
      throw new HttpError(409, "Stock insuficiente.", {
        productos: sinStock.map((p) => ({ id: p.id_producto, nombre: p.nombre_producto, disponible: p.stock_disponible })),
      });
    }

    // RN02: bloquear incompatibilidades comprobadas
    const incompat = validarCompatibilidad(prods.map((p) => ({ nombre: p.nombre_producto, categoria: p.categoria, socket_cpu: p.socket_cpu, tipo_ram: p.tipo_ram })));
    if (incompat.length) throw new HttpError(409, "La selección contiene piezas incompatibles.", { errores: incompat });

    // El total SIEMPRE se calcula con los precios de la BD, nunca con los del navegador
    const total = prods.reduce((s, p) => s + p.precio_unitario * qty.get(p.id_producto), 0);

    // RN03: sin aprobación de la pasarela no se crea el pedido
    const pago = await procesarPago({ metodo: metodo_pago, total });
    if (!pago.aprobado) throw new HttpError(402, "El pago fue rechazado.");

    // Cliente (compra sin registro obligatorio, RF-08): se reutiliza o se crea el usuario por correo.
    // Si ya existía, NO se sobrescriben sus datos (la dirección se guarda en el pedido).
    const [[u]] = await conn.query("SELECT id_usuario FROM USUARIO WHERE correo_electronico = ?", [cli.correo]);
    let idUsuario = u?.id_usuario;
    if (!idUsuario) {
      const [r] = await conn.query(
        "INSERT INTO USUARIO (correo_electronico, clave_acceso, rol_usuario) VALUES (?, ?, 'Cliente')",
        [cli.correo, `!INVITADO!${crypto.randomBytes(24).toString("hex")}`] // no es un hash válido: no permite login
      );
      idUsuario = r.insertId;
    }
    const [[c]] = await conn.query("SELECT id_cliente FROM CLIENTE WHERE id_usuario = ?", [idUsuario]);
    let idCliente = c?.id_cliente;
    if (!idCliente) {
      const [r] = await conn.query(
        "INSERT INTO CLIENTE (id_usuario, nombre, documento_identidad, telefono, direccion_envio, ciudad) VALUES (?,?,?,?,?,?)",
        [idUsuario, cli.nombre, cli.documento, cli.telefono, cli.direccion, cli.ciudad]
      );
      idCliente = r.insertId;
    }

    // PEDIDO
    const estadoPago = metodo_pago === "Contraentrega" ? "Pendiente" : "Aprobado";
    const [ped] = await conn.query(
      "INSERT INTO PEDIDO (id_cliente, estado_entrega, estado_pago, valor_total, direccion_envio) VALUES (?, 'En preparación', ?, ?, ?)",
      [idCliente, estadoPago, total, cli.direccion]
    );
    const idPedido = ped.insertId;

    // DETALLE_PEDIDO con precio congelado + descuento de stock
    await conn.query("INSERT INTO DETALLE_PEDIDO (id_pedido, id_producto, cantidad, precio_unitario_venta) VALUES ?", [
      prods.map((p) => [idPedido, p.id_producto, qty.get(p.id_producto), p.precio_unitario]),
    ]);
    for (const p of prods) {
      const [r] = await conn.query(
        "UPDATE PRODUCTO SET stock_disponible = stock_disponible - ? WHERE id_producto = ? AND stock_disponible >= ?",
        [qty.get(p.id_producto), p.id_producto, qty.get(p.id_producto)]
      );
      if (r.affectedRows !== 1) throw new HttpError(409, "Stock insuficiente.");
    }

    // FACTURA 1:1 con comprobante único (derivado del id del pedido => nunca se repite)
    const comprobante = `FAC-${new Date().getFullYear()}-${String(idPedido).padStart(6, "0")}`;
    await conn.query("INSERT INTO FACTURA (id_pedido, metodo_pago, numero_comprobante) VALUES (?,?,?)", [idPedido, metodo_pago, comprobante]);

    await conn.commit();
    res.status(201).json({
      pedido: idPedido,
      factura: comprobante,
      total,
      estado_pago: estadoPago,
      referencia_pago: pago.referencia,
      items: prods.map((p) => ({ id: p.id_producto, nombre: p.nombre_producto, cantidad: qty.get(p.id_producto), precio: p.precio_unitario })),
    });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn?.release();
  }
});

export default router;
