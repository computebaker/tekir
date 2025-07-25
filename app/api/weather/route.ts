import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from '@/lib/rate-limit-middleware';

export async function GET(request: NextRequest) {
  // Use the improved rate limiting middleware
  const rateLimitResult = await checkRateLimit(request, '/api/weather');
  
  if (!rateLimitResult.success) {
    return rateLimitResult.response!;
  }

  try {
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
