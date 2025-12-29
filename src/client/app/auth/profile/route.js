// src/client/app/auth/profile/route.js
import { NextResponse } from "next/server"

export async function GET() {
	if (process.env.NEXT_PUBLIC_ENVIRONMENT === "selfhost") {
		return NextResponse.json(
			{
				sub: "self-hosted-user",
				given_name: "User",
				name: "Self-Hosted User",
				picture: "/images/half-logo-dark.svg"
			},
			{
				headers: { "Cache-Control": "no-store, max-age=0" }
			}
		)
	}

	// In Auth0 mode, this should be handled by the Auth0 middleware
	return NextResponse.json(
		{ message: "Not authenticated" },
		{ status: 401 }
	)
}
