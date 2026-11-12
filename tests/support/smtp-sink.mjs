// Minimal SMTP server for tests. Accepts AUTH PLAIN/LOGIN and records every message as a JSON line.
import net from "node:net";
import fs from "node:fs";
export function startSmtpSink(port, file) {
  fs.mkdirSync("tests/.tmp", { recursive: true }); fs.writeFileSync(file, "");
  const srv = net.createServer((sock) => {
    let buf = "", data = false, from = "", rcpt = [], auth = 0; sock.write("220 sink ESMTP\r\n");
    sock.on("data", (c) => {
      buf += c.toString("binary");
      for (;;) {
        if (data) { const i = buf.indexOf("\r\n.\r\n"); if (i < 0) return; const raw = buf.slice(0, i); buf = buf.slice(i + 5); data = false;
          fs.appendFileSync(file, JSON.stringify({ from, rcpt, raw }) + "\n"); sock.write("250 queued\r\n"); rcpt = []; continue; }
        const i = buf.indexOf("\r\n"); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (auth === 1) { auth = 2; sock.write("334 UGFzc3dvcmQ6\r\n"); continue; } if (auth === 2) { auth = 0; sock.write("235 ok\r\n"); continue; }
        const u = line.toUpperCase();
        if (u.startsWith("EHLO") || u.startsWith("HELO")) sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
        else if (u.startsWith("AUTH PLAIN")) sock.write("235 ok\r\n"); else if (u.startsWith("AUTH LOGIN")) { auth = 1; sock.write("334 VXNlcm5hbWU6\r\n"); }
        else if (u.startsWith("MAIL FROM")) { from = line; sock.write("250 ok\r\n"); } else if (u.startsWith("RCPT TO")) { rcpt.push(line); sock.write("250 ok\r\n"); }
        else if (u === "DATA") { data = true; sock.write("354 go\r\n"); } else if (u === "QUIT") { sock.write("221 bye\r\n"); sock.end(); } else sock.write("250 ok\r\n");
      }
    });
    sock.on("error", () => {});
  });
  srv.listen(port, "127.0.0.1");
  return srv;
}
