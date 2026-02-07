import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from '@/lib/rate-limit-middleware';
import { handleAPIError } from '@/lib/api-error-tracking';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request, '/api/weather/current');
    if (!rateLimitResult.success) {
      return rateLimitResult.response!;
    }
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const units = searchParams.get("units") || "metric";

    if (!lat || !lon) {
      return handleAPIError(
        new Error("Latitude and longitude are required"),
        request,
        '/api/weather/current',
        'GET',
        400
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
    return handleAPIError(error, request, '/api/weather/current', 'GET', 500);
  }
}
