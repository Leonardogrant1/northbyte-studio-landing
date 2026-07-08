export const memolibPrivacyPolicy = `
<h1 class="privacy-title">Privacy Policy for MemoLib</h1>
<p class="last-updated">Last updated: January 13, 2026</p>

<h2>1. Controller</h2>
<p>
    The controller responsible for data processing within the meaning of the General Data Protection Regulation (GDPR) is:
</p>
<div class="contact-info">
    <p><strong>Leonardo Granetto</strong><br>
    Biebricher Straße 7f<br>
    55252 Mainz-Kastel<br>
    Germany<br><br>
    📧 <strong>Email:</strong> <a href="mailto:LeonardoGranetto@gmail.com">LeonardoGranetto@gmail.com</a></p>
</div>

<h2>2. Overview – What does MemoLib do?</h2>
<p>
    MemoLib is an application that transforms various content sources into <strong>audio playlists for learning by listening</strong>.
</p>
<p>
    Users can upload files (PDFs, photos, audio files), link YouTube videos, and MemoLib automatically converts this content 
    into high-quality audio playlists optimized for auditory learning.
</p>
<p>
    The goal of MemoLib is to make learning accessible <strong>anytime, anywhere</strong> – whether commuting, exercising, or relaxing.
</p>

<h2>3. Data We Process</h2>

<h3>3.1 Account and Authentication Data</h3>
<p>
    To use MemoLib, users must create an account.
    Authentication is handled via <strong>Supabase</strong>, which provides:
</p>
<ul>
    <li>Email authentication</li>
    <li>Social login options (e.g., Google, Apple)</li>
</ul>
<p>
    During this process, the following personal data may be processed:
</p>
<ul>
    <li>Email address</li>
    <li>Public profile information (if provided by social login providers)</li>
    <li>A unique user ID</li>
</ul>
<p>
    <strong>Legal basis:</strong> Art. 6(1)(b) GDPR (performance of a contract)
</p>

<h3>3.2 User-Uploaded Content</h3>
<p>
    When using MemoLib, you can upload various types of content:
</p>
<ul>
    <li>PDF documents</li>
    <li>Photos and images</li>
    <li>Audio files</li>
    <li>YouTube video links</li>
</ul>
<p>
    This content is processed to extract text, transcribe audio, and generate audio playlists.
    All uploaded files are stored securely in <strong>Supabase Storage</strong>.
</p>
<p>
    <strong>Legal basis:</strong> Art. 6(1)(b) GDPR
</p>

<h3>3.3 Generated Audio Playlists</h3>
<p>
    MemoLib creates audio playlists based on your uploaded content.
    These playlists are stored in your account and can be accessed, modified, or deleted at any time.
</p>

<h3>3.4 Technical and Usage Data</h3>
<p>
    To ensure security, stability, and proper functioning of the app, we may process technical data such as:
</p>
<ul>
    <li>IP address (shortened or anonymized where possible)</li>
    <li>Device and browser information</li>
    <li>Access timestamps</li>
    <li>Error and log data</li>
</ul>
<p>
    <strong>Legal basis:</strong> Art. 6(1)(f) GDPR<br>
    (Legitimate interest in maintaining security and functionality)
</p>

<h2>4. AI-Based Processing</h2>
<p>
    MemoLib uses artificial intelligence and text-to-speech technology to:
</p>
<ul>
    <li>Extract text from documents and images (OCR)</li>
    <li>Transcribe audio and video content</li>
    <li>Generate natural-sounding audio playlists</li>
    <li>Optimize content for auditory learning</li>
</ul>
<p>
    There is <strong>no automated decision-making with legal or similarly significant effects</strong> 
    within the meaning of Art. 22 GDPR.
</p>

<h2>5. Hosting and Third-Party Services</h2>

<h3>5.1 Supabase (Authentication, Database & Storage)</h3>
<p>
    All application data is hosted and processed using <strong>Supabase</strong>:
</p>
<ul>
    <li><strong>Authentication:</strong> User login and account management</li>
    <li><strong>Database:</strong> PostgreSQL database hosted in <strong>Frankfurt, Germany</strong></li>
    <li><strong>Storage:</strong> Secure file storage for uploaded content</li>
</ul>
<p>
    Supabase processes data solely on our behalf and in accordance with applicable data protection laws.
    A corresponding <strong>data processing agreement (DPA)</strong> is in place.
</p>

<h3>5.2 YouTube Integration</h3>
<p>
    When you link YouTube videos, MemoLib accesses publicly available video content through YouTube's API.
    We do not store YouTube videos themselves, only references (URLs) and extracted transcripts.
</p>

<h2>6. Data Location</h2>
<p>
    Your data is stored in the <strong>European Union (Frankfurt, Germany)</strong> through Supabase's infrastructure.
    This ensures compliance with EU data protection standards.
</p>

<h2>7. Data Sharing</h2>
<p>
    Personal data is <strong>not shared with third parties</strong>, except where:
</p>
<ul>
    <li>it is necessary to provide the service (e.g., Supabase hosting)</li>
    <li>we are legally required to do so</li>
    <li>you have given explicit consent</li>
</ul>
<p>
    No data is sold or shared for advertising purposes.
</p>

<h2>8. Data Retention</h2>
<p>
    We store personal data only for as long as:
</p>
<ul>
    <li>your user account exists, or</li>
    <li>it is necessary to fulfill contractual obligations, or</li>
    <li>legal retention requirements apply</li>
</ul>
<p>
    You can delete your uploaded files and playlists at any time.
    After account deletion, all associated data is deleted within a reasonable period.
</p>

<h2>9. Your Rights</h2>
<p>
    Under the GDPR, you have the right to:
</p>
<ul>
    <li>Access your personal data (Art. 15 GDPR)</li>
    <li>Rectify inaccurate data (Art. 16 GDPR)</li>
    <li>Request deletion of your data (Art. 17 GDPR)</li>
    <li>Restrict processing (Art. 18 GDPR)</li>
    <li>Data portability (Art. 20 GDPR)</li>
    <li>Object to processing (Art. 21 GDPR)</li>
</ul>
<p>
    You can exercise your rights at any time by contacting:
</p>
<p>
    📧 <a href="mailto:LeonardoGranetto@gmail.com">LeonardoGranetto@gmail.com</a>
</p>

<h2>10. Withdrawal of Consent</h2>
<p>
    If data processing is based on your consent, you may withdraw that consent at any time with effect for the future.
</p>

<h2>11. Changes to This Privacy Policy</h2>
<p>
    We reserve the right to update this Privacy Policy to reflect changes in legal requirements, functionality, or technology.
    The latest version will always be available within the app and/or on the website.
</p>

<h2>12. Contact</h2>
<p>
    If you have any questions regarding data protection, please contact:
</p>
<div class="contact-info">
    <p>
        📧 <strong>Email:</strong> <a href="mailto:LeonardoGranetto@gmail.com">LeonardoGranetto@gmail.com</a>
    </p>
</div>
`;
