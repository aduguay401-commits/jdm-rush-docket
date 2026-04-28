export async function sendWhatsAppNotification(message: string) {
  const phone = process.env.MARCUS_WHATSAPP_PHONE;
  const apiKey = process.env.MARCUS_WHATSAPP_APIKEY;

  if (!phone || !apiKey || apiKey === "placeholder") {
    return;
  }

  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
      phone
    )}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      console.error("[WhatsApp Notification Failed]", {
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    console.log("[WhatsApp Notification Sent]");
  } catch (error) {
    console.error("[WhatsApp Notification Error]", { error });
  }
}
