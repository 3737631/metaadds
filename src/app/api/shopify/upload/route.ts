import { NextResponse } from "next/server";
import { generateShopifyThemeZip } from "@/lib/shopify/theme-generator";
import type { StoreTheme } from "@/lib/stores/types";

export const runtime = "nodejs";

const API_VERSION = "2024-01";

function adminFetch(shop: string, token: string, path: string, init?: RequestInit) {
  const host = shop.replace(/\.?myshopify\.com$/i, "") + ".myshopify.com";
  return fetch(`https://${host}/admin/api/${API_VERSION}/${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

interface ShopTheme {
  id: number;
  name?: string;
  role?: string;
}

export async function POST(req: Request) {
  try {
    let body: { shop?: string; accessToken?: string; theme?: StoreTheme; _test?: boolean };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Cuerpo inválido." } },
        { status: 400 }
      );
    }

    const shop = body.shop?.trim();
    const token = body.accessToken?.trim();
    const theme = body.theme;

    if (!shop || !token) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Faltan el dominio de tu tienda (`tu-tienda.myshopify.com`) o tu token de acceso de admin." } },
        { status: 400 }
      );
    }

    // Modo "test": solo validamos que el token y el dominio sean correctos.
    if (body._test) {
      const themesRes = await adminFetch(shop, token, "themes.json", { cache: "no-store" });
      if (!themesRes.ok) {
        const err = await themesRes.text().catch(() => "");
        return NextResponse.json(
          { success: false, error: { code: "SHOPIFY_AUTH_ERROR", message: "No pudimos conectar con Shopify. Revisa el dominio y el token de acceso de admin." }, detail: err.slice(0, 300) },
          { status: 401 }
        );
      }
      const themesData = (await themesRes.json()) as { themes?: ShopTheme[] };
      return NextResponse.json({
        success: true,
        data: { connected: true, shop: shop.replace(/\.?myshopify\.com$/i, "") + ".myshopify.com", themeCount: themesData.themes?.length ?? 0 },
      });
    }

    if (!theme || typeof theme !== "object") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Falta el tema de la tienda." } },
        { status: 400 }
      );
    }

    const { zip, name } = await generateShopifyThemeZip(theme);

    // 1) Listar temas actuales para saber si hay uno principal que actualizar.
    let existing: ShopTheme | null = null;
    try {
      const themesRes = await adminFetch(shop, token, "themes.json", { cache: "no-store" });
      if (!themesRes.ok) {
        const err = await themesRes.text().catch(() => "");
        return NextResponse.json(
          { success: false, error: { code: "SHOPIFY_AUTH_ERROR", message: "No pudimos conectar con Shopify. Revisa el dominio y el token de acceso de admin." }, detail: err.slice(0, 300) },
          { status: 401 }
        );
      }
      const themesData = (await themesRes.json()) as { themes?: ShopTheme[] };
      existing = themesData.themes?.find((t) => t.role === "main") ?? null;
    } catch (e) {
      console.error("[shopify/upload] list themes error", e);
    }

    // 2) Preparar multipart/form-data con el ZIP.
    const form = new FormData();
    form.append("theme[name]", name.replace(/\.zip$/i, ""));
    const blob = new Blob([zip as unknown as BlobPart], { type: "application/zip" });
    form.append("theme[file]", blob, name);

    let themeId: number;
    if (existing) {
      // Actualizamos el tema principal: lo pasamos a "unpublished", subimos el nuevo,
      // y reasignamos role=main al recién subido para no guardar varios.
      await adminFetch(shop, token, `themes/${existing.id}.json`, {
        method: "PUT",
        body: JSON.stringify({ theme: { role: "unpublished" } }),
        cache: "no-store",
      });

      const createRes = await fetch(
        `https://${shop.replace(/\.?myshopify\.com$/i, "")}.myshopify.com/admin/api/${API_VERSION}/themes.json`,
        {
          method: "POST",
          headers: { "X-Shopify-Access-Token": token },
          body: form,
          cache: "no-store",
        }
      );
      const created = (await createRes.json()) as { theme?: ShopTheme };
      if (!createRes.ok || !created.theme) {
        const err = await createRes.text().catch(() => "");
        return NextResponse.json(
          { success: false, error: { code: "SHOPIFY_UPLOAD_ERROR", message: "No pudimos subir el tema a tu tienda. Revisa que el token tenga permisos de escritura de temas." }, detail: err.slice(0, 300) },
          { status: 402 }
        );
      }
      themeId = created.theme.id;
      await adminFetch(shop, token, `themes/${themeId}.json`, {
        method: "PUT",
        body: JSON.stringify({ theme: { role: "main" } }),
        cache: "no-store",
      });
    } else {
      const createRes = await fetch(
        `https://${shop.replace(/\.?myshopify\.com$/i, "")}.myshopify.com/admin/api/${API_VERSION}/themes.json`,
        {
          method: "POST",
          headers: { "X-Shopify-Access-Token": token },
          body: form,
          cache: "no-store",
        }
      );
      const created = (await createRes.json()) as { theme?: ShopTheme };
      if (!createRes.ok || !created.theme) {
        const err = await createRes.text().catch(() => "");
        return NextResponse.json(
          { success: false, error: { code: "SHOPIFY_UPLOAD_ERROR", message: "No pudimos subir el tema a tu tienda. Revisa que el token tenga permisos de escritura de temas." }, detail: err.slice(0, 300) },
          { status: 402 }
        );
      }
      themeId = created.theme.id;
      if (created.theme.role !== "main") {
        await adminFetch(shop, token, `themes/${themeId}.json`, {
          method: "PUT",
          body: JSON.stringify({ theme: { role: "main" } }),
          cache: "no-store",
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        themeId,
        themeName: name,
        shop: shop.replace(/\.?myshopify\.com$/i, "") + ".myshopify.com",
        message: "Tema subido y activado como tema principal de tu tienda.",
      },
    });
  } catch (err) {
    console.error("[/api/shopify/upload]", err);
    return NextResponse.json(
      { success: false, error: { code: "SHOPIFY_UPLOAD_ERROR", message: "Ocurrió un error al subir el tema a Shopify." } },
      { status: 500 }
    );
  }
}