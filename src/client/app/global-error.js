"use client"

export default function GlobalError({ error, reset }) {
	return (
		<html lang="en">
			<body>
				<div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
					<h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
					<p className="text-neutral-400 mb-4">{error?.message || "An unexpected error occurred"}</p>
					<button
						onClick={reset}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	)
}

