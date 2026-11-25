import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { processHireInvoiceMail } from "@/lib/hire-invoice-mail";
import { CONTACT_EMAIL } from "@/lib/product-copy";
import { isInvoicePilotDev } from "@/lib/invoice-pilot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const token = /^Bearer ([a-f0-9]{64})$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return new NextResponse(null, { status: 401 });

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const password = process.env.MNW_INVOICE_SMTP_PASSWORD;
    if (!url || !key || !password) return new NextResponse(null, { status: 503 });

    const dev = isInvoicePilotDev();
    const live = !dev && new URL(request.url).hostname === "matchnwork.se";
    if (!dev && !live) return new NextResponse(null, { status: 404 });
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: scope, error } = await db.rpc(live ? "validate_hire_bank_invoice_mail_token" : "get_hire_invoice_mail_recipient", { p_token: token });
    if (error) return new NextResponse(null, { status: 503 });
    if (live ? scope !== true : typeof scope !== "string" || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(scope)) {
      return new NextResponse(null, { status: 401 });
    }

    const smtp = nodemailer.createTransport({
      host: process.env.MNW_INVOICE_SMTP_HOST || "smtp.zoho.eu",
      port: 465,
      secure: true,
      auth: { user: CONTACT_EMAIL, pass: password },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const outcome = await processHireInvoiceMail(db, live ? null : scope, message => smtp.sendMail(message));
    return NextResponse.json({ outcome });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
