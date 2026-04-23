#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const matter = require("gray-matter");

const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

function utf8Buffer(value) {
  return Buffer.from(unescape(encodeURIComponent(value)), "binary");
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node encrypt-blog.js <input.md> <passphrase> [output.md]",
      "",
      "Example:",
      "  node encrypt-blog.js blog\\\\white-hall\\\\draft.md \"my passphrase\"",
    ].join("\n")
  );
}

function deriveKey(passphrase, saltBuffer) {
  return crypto.pbkdf2Sync(
    utf8Buffer(passphrase),
    saltBuffer,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );
}

function buildVerify(passphrase, saltBase64, ivBase64) {
  return crypto
    .createHash("sha256")
    .update(utf8Buffer(`verify|${saltBase64}|${ivBase64}|${passphrase}`))
    .digest("hex");
}

function encryptMarkdown(markdownContent, passphrase) {
  const saltBuffer = crypto.randomBytes(SALT_LENGTH);
  const ivBuffer = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = deriveKey(passphrase, saltBuffer);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer, ivBuffer);

  const encrypted = Buffer.concat([
    cipher.update(markdownContent, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const salt = saltBuffer.toString("base64");
  const iv = ivBuffer.toString("base64");
  const verify = buildVerify(passphrase, salt, iv);
  const ciphertext = Buffer.concat([encrypted, authTag]).toString("base64");

  return {
    salt,
    iv,
    verify,
    ciphertext,
  };
}

function resolveOutputPath(inputPath, outputArg) {
  if (outputArg) {
    return path.resolve(outputArg);
  }

  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}.encrypted${parsed.ext}`);
}

function main() {
  const [, , inputArg, passphrase, outputArg] = process.argv;

  if (!inputArg || !passphrase) {
    printUsage();
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  const outputPath = resolveOutputPath(inputPath, outputArg);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputPath, "utf8");
  const { data, content } = matter(source);
  const { salt, iv, verify, ciphertext } = encryptMarkdown(content, passphrase);

  const nextData = {
    ...data,
    encrypted: true,
    verify,
    salt,
    iv,
    kdf: "pbkdf2-sha256",
    iterations: PBKDF2_ITERATIONS,
    cipher: "aes-256-gcm",
  };

  const output = matter.stringify(ciphertext, nextData);
  fs.writeFileSync(outputPath, output, "utf8");

  console.log(`Encrypted markdown written to: ${outputPath}`);
  console.log(
    JSON.stringify(
      {
        verify,
        salt,
        iv,
        kdf: nextData.kdf,
        iterations: nextData.iterations,
        cipher: nextData.cipher,
      },
      null,
      2
    )
  );
}

main();
