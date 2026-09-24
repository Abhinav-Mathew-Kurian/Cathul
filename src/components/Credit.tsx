import { HeartIcon } from "./doodles";

export function Credit() {
  return (
    <p className="bg-white py-3 text-center font-script text-base text-ink/45">
      with <HeartIcon className="inline-block h-3 w-3 -translate-y-0.5 text-red-500" /> by{" "}
      <a
        href="https://temenlabs.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-dotted underline-offset-2 hover:text-ink/70"
      >
        TemenLabs
      </a>
    </p>
  );
}
