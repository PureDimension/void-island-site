import Link from "next/link";

export default function ReturnButton() {
	return (
		<div className="fixed top-4 right-4 z-10">
			<Link href="/">
				<button className="bg-white text-black px-3 py-1 font-bold rounded shadow-lg">
					返回
				</button>
			</Link>
		</div>
	);
}
