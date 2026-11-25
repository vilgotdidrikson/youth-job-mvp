import { handlePrivacyCases } from "@/lib/server/privacy-case-handler";
export const runtime = "nodejs";
export const POST = (request: Request) => handlePrivacyCases(request);
