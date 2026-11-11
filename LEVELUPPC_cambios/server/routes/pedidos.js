import { Router } from "express";
import { pool, HttpError } from "../db.js";

const router = Router();

// Rastreo de pedido: requiere comprobante Y correo (evita enumerar pedidos ajenos).
router.get("/pedidos/rastrear", async (req, res, next) => {
  try {
    const factura = String(req.query.factura || "").trim().toUpperCase();
    const correo = String(req.query.correo || "").trim().toLowerCase();
    if (!factura || !correo) throw new HttpError(400, "Indica el número de factura y el correo.");

    const [rows] = await pool.query(
      `SELECT p.id_pedido, p.fecha_pedido, p.estado_entrega, p.estado_pago, p.valor_total, f.numero_comprobante
       FROM FACTURA f
       JOIN PEDIDO p ON p.id_pedido = f.id_pedido
       JOIN CLIENTE c ON c.id_cliente = p.id_cliente
       JOIN USUARIO u ON u.id_usuario = c.id_usuario
       WHERE f.numero_comprobante = ? AND u.correo_electronico = ?`,
      [factura, correo]
    );
    if (!rows.length) throw new HttpError(404, "No encontramos un pedido con esos datos.");
    const ped = rows[0];

    const [items] = await pool.query(
      `SELECT pr.nombre_producto AS nombre, d.cantidad, d.precio_unitario_venta AS precio
       FROM DETALLE_PEDIDO d JOIN PRODUCTO pr ON pr.id_producto = d.id_producto
       WHERE d.id_pedido = ?`,
      [ped.id_pedido]
    );
    res.json({
      pedido: ped.id_pedido,
      factura: ped.numero_comprobante,
      fecha: ped.fecha_pedido,
      estado_entrega: ped.estado_entrega,
      estado_pago: ped.estado_pago,
      total: ped.valor_total,
      items,
    });
  } catch (err) { next(err); }
});

export default router;
