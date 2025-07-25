import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, incrementAndCheckRequestCount } from '@/lib/convex-session';

export async function GET(request: NextRequest) {
  try {
    // Check session token and rate limiting
    const sessionToken = request.cookies.get('session-token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Session token required' }, { status: 401 });
    }

    const isValid = await isValidSessionToken(sessionToken);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired session token' }, { status: 401 });
    }

    // Check rate limiting
    const { allowed, currentCount } = await incrementAndCheckRequestCount(sessionToken);
    if (!allowed) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded', 
        currentCount,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
      }, { status: 429 });
    }
    // Get client IP from headers
    const forwarded = request.headers.get("x-forwarded-for");
    const realIP = request.headers.get("x-real-ip");
    const cfConnectingIP = request.headers.get("cf-connecting-ip");
    const clientIP = forwarded?.split(",")[0]?.trim() || realIP || cfConnectingIP || "127.0.0.1";

    // Call the Clim8 weather API for IP-based lookup
    const response = await fetch("https://clim8.tekir.co/api/weather/ip-lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://tekir.co"
      },
      body: JSON.stringify({
        ip: clientIP
      })
    });

    if (!response.ok) {
      throw new Error(`Weather API responded with status: ${response.status}`);
    }

    const weatherData = await response.json();
    
    return NextResponse.json(weatherData);
  } catch (error) {
    console.error("Weather API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weather data" },
      { status: 500 }
    );
  }
}
