import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import FeedbackEmail from '@/components/emails/student-feedback-email';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { studentEmail, studentName } = await request.json();

    if (!studentEmail) {
      return NextResponse.json({ error: 'Student email is required' }, { status: 400 });
    }

    await resend.emails.send({
      from: process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',')[1]?.trim() || 'ConnectMe Tutors <noreply@connectmego.org>',
      to: studentEmail,
      subject: 'Please provide feedback for your recent session',
      react: FeedbackEmail({ studentName }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}