import Image from 'next/image';

const features = [
  {
    emoji: '📂',
    title: 'Organized Repository',
    description: 'Everything is stored by department, level and course.',
  },
  {
    emoji: '🔍',
    title: 'Powerful Search',
    description: 'Full-text search across every approved resource, filterable by type, semester and year.',
  },
  {
    emoji: '🤖',
    title: 'AI Question Generation',
    description: 'Generates practice questions from approved, opted-in course material.',
  },
  {
    emoji: '📝',
    title: 'Course Request System',
    description: 'Students can request a course be added when it isn’t listed yet.',
  },
  {
    emoji: '📤',
    title: 'Upload & Review Workflow',
    description: 'Every upload is reviewed before it goes public, with a full audit trail.',
  },
  {
    emoji: '👨‍🏫',
    title: 'Lecturer Verification',
    description: 'Lecturers can mark resources as verified, separate from admin approval.',
  },
  {
    emoji: '🛡',
    title: 'Academic Integrity',
    description: 'Courses can opt out of AI indexing to protect past exams and sensitive material.',
  },
  {
    emoji: '🏛',
    title: 'University-wide Scalability',
    description: 'Built with zero hardcoded department or level assumptions.',
  },
  {
    emoji: '📈',
    title: 'Audit Logs',
    description: 'Every approval, rejection and deletion is logged for accountability.',
  },
  {
    emoji: '☁',
    title: 'Cloud Storage',
    description: 'Files live in durable, secure storage — not scattered across chats and drives.',
  },
  {
    emoji: '🔐',
    title: 'Secure Authentication',
    description: 'CU-domain-restricted sign-in via Google OAuth or email/password.',
  },
  {
    emoji: '⚡',
    title: 'Fast Resource Access',
    description: 'Approved resources are public and downloadable, no login required.',
  },
];

export default function AboutCreatorPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="flex flex-col items-center text-center">
        <div className="h-32 w-32 overflow-hidden rounded-full border-2 border-amber-500/40">
          <Image
            src="/creator-photo.jpg"
            alt="Okhiria Oseojie"
            width={256}
            height={256}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        <h2 className="mt-6 text-2xl font-semibold text-ink-950">Meet Okhiria Oseojie</h2>
        <p className="mt-1 text-amber-500">Aspiring Academic Advisor</p>
        <p className="text-sm text-ink-700/60">NACOS 2026/2027 Session</p>
      </section>

      {/* Why DARMS */}
      <section>
        <h3 className="mb-4 text-lg font-semibold text-ink-950">Why DARMS?</h3>
        <div className="space-y-4 rounded-lg border border-paper-200 bg-paper-100 p-6 text-ink-700/80">
          <p>
            Every semester, thousands of academic resources are scattered across WhatsApp
            groups, Telegram channels, Google Drive folders and personal devices. Students
            repeatedly ask the same questions:
          </p>
          <p className="italic text-ink-950">
            &ldquo;Does anyone have CSC201?&rdquo;
            <br />
            &ldquo;Can someone send last year&apos;s exam?&rdquo;
            <br />
            &ldquo;Who has the lecture slides?&rdquo;
          </p>
          <p>
            Valuable academic materials become lost simply because there is no structured
            repository.
          </p>
          <p className="font-medium text-ink-950">DARMS was built to solve that problem.</p>
          <p>
            Instead of students depending on luck or personal connections, every approved
            academic resource can be organized, verified and made easily searchable for
            everyone.
          </p>
        </div>
      </section>

      {/* Vision */}
      <section>
        <h3 className="mb-4 text-lg font-semibold text-ink-950">The Vision</h3>
        <p className="text-ink-700/80">
          A department where no student loses marks or falls behind simply because they
          didn&apos;t know the right group chat to be in — where every approved note, test
          and past exam is one search away, verified, organized and available to everyone at
          once.
        </p>
      </section>

      {/* Features */}
      <section>
        <h3 className="mb-6 text-lg font-semibold text-ink-950">Features of DARMS</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-paper-200 bg-paper-100 p-4"
            >
              <div className="text-2xl">{f.emoji}</div>
              <div className="mt-2 font-medium text-ink-950">{f.title}</div>
              <p className="mt-1 text-sm text-ink-700/60">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AGIP Leadership */}
      <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-6">
        <h3 className="mb-4 text-lg font-semibold text-amber-500">AGIP Leadership</h3>
        <div className="space-y-4 text-ink-700/80">
          <p>
            Leadership is more than holding a position — it is accepting responsibility for
            the growth of others.
          </p>
          <p>
            Through DARMS, my vision is to build a culture where accountability becomes the
            standard, integrity guides every decision, progress is measurable, and every
            student has equal access to the resources they need to succeed.
          </p>
          <p>
            If entrusted with the role of Academic Advisor, I hope to create systems that
            outlive my tenure — systems that continue serving students long after the
            campaign is over.
          </p>
          <p className="font-mono text-sm text-amber-500">
            #AGIPLeadership&nbsp;&nbsp;#Ojie4AcadAdvs
          </p>
        </div>
      </section>

      {/* Poster */}
      <section>
        <h3 className="mb-4 text-lg font-semibold text-ink-950">Campaign Poster</h3>
        <div className="overflow-hidden rounded-lg border border-paper-200">
          <Image
            src="/campaign-poster.png"
            alt="Vote Okhiria Oseojie for Academic Advisor — AGIP Leadership"
            width={1414}
            height={1760}
            className="h-auto w-full"
          />
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-lg border border-paper-200 bg-paper-100 p-6 text-center">
        <h3 className="text-lg font-semibold text-ink-950">Have suggestions?</h3>
        <p className="mx-auto mt-2 max-w-xl text-ink-700/70">
          DARMS is a project built with students in mind, and like every great system, it can
          continue to improve. If you have ideas, feature suggestions, or notice something
          that could be better, I&apos;d genuinely love to hear from you.
        </p>
        <a
          href="mailto:ookhiria.2302662@stu.cu.edu.ng"
          className="mt-4 inline-block font-mono text-amber-500 hover:underline"
        >
          ookhiria.2302662@stu.cu.edu.ng
        </a>
      </section>
    </div>
  );
}
