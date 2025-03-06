import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Terms of Service - Tekir',
  description: 'Terms and conditions for using Tekir services',
}

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-block mb-6">
          <Image 
            src="/tekir.png" 
            alt="Tekir Logo" 
            width={120} 
            height={40} 
            className="h-auto" 
            priority
          />
        </Link>
        
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Terms of Service</h1>
        
        <div className="space-y-8">
          <section>
            <p className="text-sm text-gray-500 mb-4">Last updated: 6th of February, 2025</p>
            <p>Please read these terms of service carefully before using our service. By accessing or using our services, you agree to be bound by these terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using our services, you agree to be bound by these terms. If you disagree with any part of the terms, you may not access the service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Use of Service</h2>
            <p className="mb-3">Our service is intended for both your personal and commercial usage, under the following limitations:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Don't use the service for any illegal purpose or in violation of Turkish laws</li>
              <li>Don't infringe or violate the intellectual property rights of others</li>
              <li>Don't transmit any material that is harmful, threatening, abusive, or otherwise objectionable</li>
              <li>Don't interfere with or disrupt the service or servers or networks connected to the service</li>
              <li>Don't attempt to gain unauthorized access to any part of the service</li>
              <li>Don't try to scrape data off the site, including the usage of APIs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Account Registration</h2>
            <p className="mb-3">To access certain features of our service, you may be required to register for an account. You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your account credentials secure and confidential</li>
              <li>Be responsible for all activities that occur under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">4. User Content</h2>
            <p className="mb-3">When you create or make available any content through our service, you represent and warrant that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You own or have the necessary rights to use and authorize the use of the content</li>
              <li>The content does not violate any third party rights</li>
              <li>The content complies with these Terms and applicable law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Termination</h2>
            <p>We may terminate or suspend your account or block your IP addresses and bar access to the service immediately, without prior notice or liability, for a breach of the terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Limitation of Liability</h2>
            <p>In no event shall Tekir, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Changes to Terms</h2>
            <p>We reserve the right to modify or replace these terms at any time. If a revision is made, we will provide a notification to all our customers within a 7 day period.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Governing Law</h2>
            <p>These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Tekir operates, without regard to its conflict of law provisions.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">9. Contact Us</h2>
            <p>If you have any questions about these terms, please contact us at:</p>
            <p className="mt-2">Email: <a href="mailto:support@tekir.co">support@tekir.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
