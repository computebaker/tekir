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
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const units = searchParams.get("units") || "metric";

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    // Call the Clim8 weather API for coordinates-based lookup
    const response = await fetch(
      `https://clim8.tekir.co/api/weather/current?lat=${lat}&lon=${lon}&units=${units}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://tekir.co"
        }
      }
    );

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
