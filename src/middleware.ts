import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn  = !!req.auth;
  const path        = req.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const isAuthApi   = path.startsWith("/api/auth");

  if (!isLoggedIn && !isLoginPage && !isAuthApi) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
