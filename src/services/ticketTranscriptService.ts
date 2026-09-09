import {
  AttachmentBuilder,
  type TextChannel,
} from "discord.js";

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatContent(
  content: string,
): string {
  if (!content) {
    return (
      '<span class="muted">' +
      "(ไม่มีข้อความ หรือบอทไม่สามารถอ่าน Message Content ได้)" +
      "</span>"
    );
  }

  return escapeHtml(
    content,
  ).replaceAll(
    "\n",
    "<br>",
  );
}

export const ticketTranscriptService = {
  async create(
    channel: TextChannel,
    ticketId: string,
  ) {
    const messages: any[] = [];
    let before: string | undefined;
    const MAX_MESSAGES = 5000;

    while (
      messages.length <
      MAX_MESSAGES
    ) {
      const batch =
        await channel.messages.fetch({
          limit: 100,
          before,
        });

      if (batch.size === 0) {
        break;
      }

      messages.push(
        ...batch.values(),
      );

      const oldest =
        batch.last();

      if (!oldest) {
        break;
      }

      before = oldest.id;

      if (batch.size < 100) {
        break;
      }
    }

    messages.sort(
      (a, b) =>
        a.createdTimestamp -
        b.createdTimestamp,
    );

    const rows =
      messages.map(
        (message) => {
          const attachments =
            [
              ...message.attachments.values(),
            ]
              .map(
                (attachment: any) =>
                  `<a href="${escapeHtml(attachment.url)}" target="_blank">📎 ${escapeHtml(attachment.name ?? "attachment")}</a>`,
              )
              .join("<br>");

          const embeds =
            message.embeds
              .map(
                (embed: any) =>
                  [
                    embed.title,
                    embed.description,
                  ]
                    .filter(Boolean)
                    .map(
                      (value) =>
                        escapeHtml(
                          String(value),
                        ),
                    )
                    .join(" — "),
              )
              .filter(Boolean)
              .map(
                (value: string) =>
                  `<div class="embed">Embed: ${value}</div>`,
              )
              .join("");

          const time =
            new Date(
              message.createdTimestamp,
            ).toLocaleString(
              "th-TH",
              {
                timeZone:
                  "Asia/Bangkok",
              },
            );

          return `
<article class="message">
  <img class="avatar" src="${escapeHtml(
    message.author.displayAvatarURL({
      extension: "png",
      size: 64,
    }),
  )}" alt="">
  <div class="body">
    <div class="header">
      <strong>${escapeHtml(
        message.author.globalName ??
        message.author.username,
      )}</strong>
      <span class="uid">${escapeHtml(
        message.author.id,
      )}</span>
      <time>${escapeHtml(time)}</time>
    </div>
    <div class="content">${formatContent(
      message.content,
    )}</div>
    ${attachments ? `<div class="attachments">${attachments}</div>` : ""}
    ${embeds}
  </div>
</article>`;
        },
      )
      .join("\n");

    const truncated =
      messages.length >=
      MAX_MESSAGES;

    const html =
      `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>NEXORA Ticket ${escapeHtml(ticketId)}</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0b0d14;color:#e6e8ef;font:15px/1.55 Inter,system-ui,-apple-system,sans-serif}main{max-width:1050px;margin:auto;padding:32px 18px 80px}.hero{padding:24px;border:1px solid #2d3145;border-radius:18px;background:linear-gradient(135deg,#171a29,#10121c);margin-bottom:20px}.hero h1{margin:0 0 5px;font-size:24px}.hero p{margin:0;color:#9499ad}.message{display:flex;gap:12px;padding:13px 10px;border-radius:10px}.message:hover{background:#121520}.avatar{width:40px;height:40px;border-radius:50%;flex:none}.body{min-width:0;flex:1}.header{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.header strong{color:#fff}.uid,time{font-size:12px;color:#71778d}.content{margin-top:3px;overflow-wrap:anywhere}.attachments{margin-top:7px}.attachments a{color:#70b7ff}.embed{border-left:3px solid #8b5cf6;background:#151827;padding:8px 11px;margin-top:7px;border-radius:4px;color:#c7cad6}.muted{color:#74798b;font-style:italic}.warn{color:#ffcc66}
</style>
</head>
<body>
<main>
  <section class="hero">
    <h1>🎫 NEXORA Ticket Transcript</h1>
    <p>Ticket ${escapeHtml(ticketId)} • #${escapeHtml(channel.name)} • ${messages.length.toLocaleString()} messages</p>
    ${truncated ? `<p class="warn">Transcript จำกัดไว้ที่ ${MAX_MESSAGES.toLocaleString()} ข้อความล่าสุด</p>` : ""}
  </section>
  ${rows || "<p>ไม่มีข้อความใน Ticket</p>"}
</main>
</body>
</html>`;

    const name =
      `transcript-${ticketId.toLowerCase()}.html`;

    const buffer =
      Buffer.from(
        html,
        "utf8",
      );

    return {
      name,
      buffer,
      attachment:
        new AttachmentBuilder(
          buffer,
          {
            name,
          },
        ),
      messageCount:
        messages.length,
      truncated,
    };
  },
};
