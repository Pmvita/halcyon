import { PostButton } from "@/components/post";

export default function SecurityPage() {
  return (
    <>
      <p className="kicker">Security</p>
      <h1 className="serif" style={{ fontSize: 48 }}>Sessions and step-up</h1>
      <p>Passwords are Argon2id. The session cookie is httpOnly. Sending $5,000 or more, and showing a card number, asks for the password again. Demo 2FA can be reset with the persona; this build shows the enrollment note rather than a live QR until you turn it on from the admin flag.</p>
      <PostButton href="/api/v1/auth/logout" body={{}}>Log out</PostButton>
    </>
  );
}
