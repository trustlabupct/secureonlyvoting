import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/',
      sameSite: 'lax',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error setting cookie:', error);
    return NextResponse.json(
      { error: 'Failed to set cookie' },
      { status: 500 }
    );
  }
} 