import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('printer_token')?.value
  const { pathname } = req.nextUrl

  const publicPaths = ['/login', '/forgot-password', '/reset-password']
  if (!token && !publicPaths.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
