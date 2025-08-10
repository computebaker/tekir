import type { Metadata } from 'next'
import LegalShell from '@/components/layout/legal-shell'

export const metadata: Metadata = {
  title: 'Privacy Policy - Tekir',
  description: 'Privacy policy and data protection information for Tekir users',
}

export default function PrivacyPage() {
  return (
  <LegalShell title="Privacy Policy">
          <section>
            <p className="text-sm text-muted-foreground mb-4">Last updated: 6th of February, 2025</p>
            <p>At Tekir, we take your privacy seriously. This policy explains how we collect, use and safeguard your information when you use our service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Information We Collect</h2>
            <p className="mb-3">We collect anonymised information that you provide directly to us when you:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access or use our service</li>
              <li>Create an account or profile</li>
              <li>Use interactive features of our service</li>
              <li>Communicate with us directly</li>
            </ul>
            <br /> 
            <p className="mb-3">We collect these information with compliance to the GDPR & CCPA to protect your full anonymity.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">How We Use Your Information</h2>
            <p className="mb-3">We may use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Analyze trends, usage, and activities in connection with our service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Sharing of Information</h2>
            <p className="mb-3">We never share any information that we collect with our telemetry software with 3rd parties.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Your Choices</h2>
            <p className="mb-3">You have several choices regarding the information you provide to us:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Update or correct your account information at any time by logging into your account</li>
              <li>Request deletion of your personal information by contacting us</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Data Security</h2>
            <p>We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration, and destruction.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Changes to this Policy</h2>
            <p>We may change this privacy policy from time to time. If we make changes, we will notify you by revising the date at the top of the policy and, in some cases, we may provide you with additional notice.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
            <p>If you have any questions about this policy, please contact us at:</p>
            <p className="mt-2">Email: <a href="mailto:support@tekir.co">support@tekir.co</a></p>
          </section>
  </LegalShell>
  )
}
