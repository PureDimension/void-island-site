"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const DEFAULT_ITERATIONS = 120000;

function base64ToBytes(base64) {
  const binary = window.atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildVerify(passphrase, salt, iv) {
  const data = new TextEncoder().encode(`verify|${salt}|${iv}|${passphrase}`);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function decryptContent({ ciphertext, passphrase, salt, iv, iterations }) {
  const importedKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(salt),
      iterations: iterations || DEFAULT_ITERATIONS,
      hash: "SHA-256",
    },
    importedKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["decrypt"]
  );

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(iv),
    },
    key,
    base64ToBytes(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

export default function EncryptedBlogContent({
  ciphertext,
  verify,
  salt,
  iv,
  iterations,
  isDarkMode,
  isMobile = false,
  onUnlock,
}) {
  const searchParams = useSearchParams();
  const [passphrase, setPassphrase] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    const keyFromUrl = searchParams.get("key") || "";
    setPassphrase(keyFromUrl);
    setErrorMessage("");
  }, [searchParams, ciphertext]);

  async function handleUnlock() {
    if (!passphrase) {
      setErrorMessage("请输入口令。");
      return;
    }

    if (!verify || !salt || !iv) {
      setErrorMessage("该加密文件缺少必要参数，暂时无法解密。");
      return;
    }

    setIsUnlocking(true);
    setErrorMessage("");

    try {
      const nextVerify = await buildVerify(passphrase, salt, iv);
      if (nextVerify !== verify) {
        setErrorMessage("口令错误，请重新输入。");
        return;
      }

      const markdown = await decryptContent({
        ciphertext,
        passphrase,
        salt,
        iv,
        iterations,
      });

      onUnlock(markdown);
    } catch {
      setErrorMessage("解密失败，请确认口令和文件格式是否正确。");
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <div
      className={`mx-auto mt-8 max-w-xl rounded-lg border-2 p-5 ${
        isDarkMode
          ? "border-gray-600 bg-gray-900/80 text-white"
          : "border-gray-300 bg-gray-50 text-black"
      }`}
    >
      <p className="mb-4 text-center text-base font-semibold">
        该文件为加密文件，需要输入口令
      </p>
      <div className={`flex gap-3 ${isMobile ? "flex-col" : "items-stretch"}`}>
        <input
          type="text"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleUnlock();
            }
          }}
          placeholder="请输入口令"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="done"
          className={`min-w-0 flex-1 rounded border px-3 py-2 outline-none ${
            isDarkMode
              ? "border-gray-500 bg-black text-white placeholder:text-gray-400"
              : "border-gray-300 bg-white text-black placeholder:text-gray-500"
          }`}
        />
        <button
          type="button"
          onClick={handleUnlock}
          disabled={isUnlocking}
          className={`rounded px-4 py-2 font-semibold transition ${isMobile ? "w-full" : ""} ${
            isDarkMode
              ? "bg-white text-black hover:bg-gray-200 disabled:bg-gray-500"
              : "bg-black text-white hover:bg-gray-800 disabled:bg-gray-400"
          }`}
        >
          {isUnlocking ? "校验中" : "确认"}
        </button>
      </div>
      {errorMessage ? <p className="mt-3 text-sm text-red-500">{errorMessage}</p> : null}
    </div>
  );
}
