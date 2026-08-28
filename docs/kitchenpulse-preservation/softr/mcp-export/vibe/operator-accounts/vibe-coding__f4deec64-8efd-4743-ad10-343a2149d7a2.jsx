import { MailPlus, ShieldCheck, UserPlus } from "lucide-react";

function KitchenPulseLockup() {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline">
        <span
          className="text-[25px] font-black tracking-[-0.055em] md:text-[31px]"
          style={{
            color: "#F8FAFC",
            textShadow: "0 1px 16px rgba(0,0,0,0.28)",
          }}
        >
          Kitchen
        </span>

        <span
          className="text-[25px] font-black tracking-[-0.055em] md:text-[31px]"
          style={{
            color: "#22D3EE",
            textShadow: "0 0 18px rgba(34,211,238,0.32)",
          }}
        >
          Pulse
        </span>
      </div>

      <div
        className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.32em]"
        style={{ color: "rgba(226,232,240,0.68)" }}
      >
        Operator access
      </div>
    </div>
  );
}

function MiniSignal({ icon: Icon, title, text, color }) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        background: "rgba(255,255,255,0.055)",
        borderColor: "rgba(255,255,255,0.09)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
        <div className="min-w-0">
          <div className="text-sm font-semibold" style={{ color: "#F8FAFC" }}>
            {title}
          </div>
          <div
            className="mt-1 text-xs leading-relaxed"
            style={{ color: "rgba(226,232,240,0.66)" }}
          >
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OperatorAccountsHero() {
  return (
    <div className="container py-5 md:py-6">
      <div
        className="relative overflow-hidden rounded-[28px] border shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, #03101C 0%, #071827 48%, #101936 100%)",
          borderColor: "rgba(103,232,249,0.14)",
          boxShadow:
            "0 22px 60px rgba(2,8,23,0.34), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 18% 18%, rgba(34,211,238,0.20), transparent 28%), radial-gradient(circle at 82% 18%, rgba(99,102,241,0.16), transparent 28%)",
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.052) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.052) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
            opacity: 0.13,
          }}
        />

        <div className="relative z-10 px-6 py-7 md:px-9 md:py-8">
          <div className="grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="min-w-0">
              <div
                className="mb-5 inline-flex items-center rounded-[22px] px-4 py-3"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow:
                    "0 12px 30px rgba(2,8,23,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <KitchenPulseLockup />
              </div>

              <h1
                className="font-semibold tracking-[-0.035em]"
                style={{
                  color: "#F8FAFC",
                  fontSize: "clamp(34px, 4vw, 54px)",
                  lineHeight: "1.02",
                  textShadow: "0 1px 18px rgba(0,0,0,0.28)",
                }}
              >
                Operator Accounts
              </h1>

              <p
                className="mt-4 max-w-2xl"
                style={{
                  color: "rgba(226,232,240,0.84)",
                  fontSize: "clamp(14px, 1.25vw, 17px)",
                  lineHeight: "1.55",
                }}
              >
                Add chefs, managers, and reviewers to KitchenPulse. Create the
                account below, assign access, and KitchenPulse will send the invite.
              </p>
            </div>

            <div className="grid gap-3">
              <MiniSignal
                icon={UserPlus}
                color="#67E8F9"
                title="Create the operator"
                text="Add their name, email, role, and app permissions."
              />

              <MiniSignal
                icon={MailPlus}
                color="#A5B4FC"
                title="Invite automatically"
                text="Vercel creates the access row and Clerk sends the login invite."
              />

              <MiniSignal
                icon={ShieldCheck}
                color="#22C55E"
                title="Access stays controlled"
                text="Only approved Operator Users can sign into the mobile app."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
