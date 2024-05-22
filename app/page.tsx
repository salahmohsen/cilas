import { Nav } from "@/components/ui/header/navigation";
import logo from "@/public/logo.png";
import Image from "next/image";

export default function Home() {
  return (
    <main className="mx-10 min-w-screen">
      <header className="flex justify-between gap-10 items-center mt-5">
        <div className="flex items-center gap-5">
          <Image
            src={logo}
            width={25}
            alt="Cairo Institute of Liberal Arts and Sciences"
          />
          <h1 className=" font-bold">
            Cairo Institute of Liberal Arts and Sciences
          </h1>
        </div>
        <Nav />
      </header>
    </main>
  );
}
