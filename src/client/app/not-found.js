export default function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-4">
			<h2 className="text-2xl font-bold mb-4">404 - Page Not Found</h2>
			<p className="text-neutral-400 mb-4">The page you are looking for does not exist.</p>
			<a
				href="/"
				className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
			>
				Go Home
			</a>
		</div>
	)
}

