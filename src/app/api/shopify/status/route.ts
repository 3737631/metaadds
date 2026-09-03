import { NextResponse } from "next/server";

export async function GET() {
  const hasCreds = Boolean(
    process.env.SHOPIFY_CLIENT_ID &&
      process.env.SHOPIFY_CLIENT_SECRET &&
      process.env.SHOPIFY_SHOP
  );

  if (!hasCreds) {
    return NextResponse.json({
      success: true,
      data: {
        connected: false,
        shop: null,
        scopes: null,
        note: "Añade tus credenciales de Shopify (SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_SHOP) en Vercel para conectar tu tienda.",
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      connected: true,
      shop: process.env.SHOPIFY_SHOP,
      scopes: ["read_themes", "write_themes", "read_products", "write_products"],
    },
  });
}
