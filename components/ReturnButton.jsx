import Link from "next/link";

export default function ReturnButton() {
  return (
    <div className="fixed top-5 right-5 z-10">
      <Link href="/">
        <button
          className="
            px-4 py-2
            rounded-lg
            border border-white
            bg-[rgba(0,0,0,0.4)]
            text-white
            font-semibold
            shadow-md
            transition
            duration-200
            hover:bg-white hover:text-black
            active:scale-95
            focus:outline-none focus:ring-2 focus:ring-white
          "
          aria-label="返回主页"
        >
          返回
        </button>
      </Link>
    </div>
  );
}
