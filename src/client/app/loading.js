export default function Loading() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-neutral-950 text-white">
			<div className="text-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
				<p className="text-neutral-400">Loading...</p>
			</div>
		</div>
	)
}

