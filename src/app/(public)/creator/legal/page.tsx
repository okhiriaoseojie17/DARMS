export default function LegalCopyrightPage() {
  return (
    <div className="space-y-12">
      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-950">Overview</h3>
        <p className="text-ink-700/80">
          This page explains the ownership and current status of DARMS (Department Academic
          Resource Management System), which was designed and built as part of a campaign for
          Academic Advisor within the Nigerian Association of Computing Students (NACOS),
          Covenant University chapter.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-950">Intellectual Property</h3>
        <p className="text-ink-700/80">
          DARMS — including its branding, logo, architecture, documentation, UI/UX designs
          and source code — is the original work of Okhiria Oseojie unless otherwise noted.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-950">Campaign Notice</h3>
        <ul className="list-disc space-y-2 pl-5 text-ink-700/80">
          <li>DARMS is currently an independent initiative.</li>
          <li>It was developed as part of a campaign for Academic Advisor.</li>
          <li>
            It is not yet affiliated with, endorsed by, or officially adopted by Covenant
            University or NACOS.
          </li>
          <li>Any institutional deployment would only occur through the appropriate approval processes.</li>
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-950">Disclaimer</h3>
        <p className="text-ink-700/80">
          DARMS is provided as-is, as a proof-of-concept student project. Content on this
          campaign page reflects the personal views of its creator and is subject to change
          without notice.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-950">Future Adoption</h3>
        <p className="text-ink-700/80">
          Although DARMS currently serves as an independent proof of concept, my hope is that
          it demonstrates what thoughtful, student-focused innovation can achieve. If adopted
          in the future through the appropriate institutional channels, DARMS has the
          potential to become a lasting academic resource that benefits generations of
          students.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold text-ink-950">Contact</h3>
        <a
          href="mailto:ookhiria.2302662@stu.cu.edu.ng"
          className="font-mono text-amber-500 hover:underline"
        >
          ookhiria.2302662@stu.cu.edu.ng
        </a>
      </section>
    </div>
  );
}
