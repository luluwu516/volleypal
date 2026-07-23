import { NextResponse } from "next/server";
import { z } from "zod";
import { findAdminByPin } from "@/lib/auth/pin";
import { getAdminSession } from "@/lib/auth/getSession";
import { assertSessionConfigured } from "@/lib/auth/session";
import { tryRateLimit, clientIp } from "@/lib/rateLimit";

const Body = z.object({ pin: z.string().min(4).max(32) });

export async function POST(req: Request) {
  try {
    assertSessionConfigured();
    const ip = clientIp(req);
    if (!(await tryRateLimit(`pin:${ip}`, 5, 60))) {
      return NextResponse.json(
        { error: "嘗試次數過多,請稍後再試" },
        { status: 429 },
      );
    }
    const { pin } = Body.parse(await req.json());
    const admin = await findAdminByPin(pin);
    if (!admin) {
      return NextResponse.json({ error: "PIN 不正確" }, { status: 401 });
    }
    const sess = await getAdminSession();
    sess.adminId = admin.id;
    sess.adminName = admin.name;
    sess.loggedInAt = Date.now();
    await sess.save();
    return NextResponse.json({ ok: true, name: admin.name });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error" },
      { status: 400 },
    );
  }
}
