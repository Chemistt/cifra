import {
  FileIcon,
  FolderIcon,
  LockIcon,
  ShareIcon,
  ShieldIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: UploadIcon,
    title: "Secure File Upload",
    description:
      "Upload files with confidence using our secure, encrypted storage system.",
  },
  {
    icon: FolderIcon,
    title: "Smart Organization",
    description:
      "Organize your files with folders, tags, and powerful search capabilities.",
  },
  {
    icon: LockIcon,
    title: "Password Protection",
    description:
      "Protect sensitive files and folders with password encryption.",
  },
  {
    icon: ShareIcon,
    title: "Easy Sharing",
    description: "Share files securely with customizable access controls.",
  },
  {
    icon: ShieldIcon,
    title: "Seamless Encryption",
    description:
      "Automatic AES-GCM encryption on upload and transparent decryption on download. Zero-friction security.",
  },
  {
    icon: FileIcon,
    title: "All File Types",
    description:
      "Support for all file types with intelligent preview capabilities.",
  },
];

export default function LandingPage() {
  return (
    <div className="from-background to-muted/20 min-h-screen bg-gradient-to-b">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-4">
            <Badge variant="secondary" className="mb-4">
              🚀 Secure File Management
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Your Files,
              <span className="text-primary"> Secured</span> &
              <span className="text-primary"> Organized</span>
            </h1>
            <p className="text-muted-foreground text-lg sm:text-xl">
              Cifra provides enterprise-grade security for your file storage and
              sharing needs. Upload, organize, and share your files with
              confidence.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="px-8">
              <Link href="/auth">Get Started Free</Link>
            </Button>
            <Button variant="outline" size="lg" className="px-8">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything you need for secure file management
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
              Built with modern security standards and designed for teams and
              individuals who value privacy and organization.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="relative overflow-hidden">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-muted/50 py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="text-primary text-4xl font-bold">256-bit</div>
                <div className="text-muted-foreground">Encryption</div>
              </div>
              <div className="text-center">
                <div className="text-primary text-4xl font-bold">99.9%</div>
                <div className="text-muted-foreground">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-primary text-4xl font-bold">∞</div>
                <div className="text-muted-foreground">File Types</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight">
                Ready to secure your files?
              </h2>
              <p className="text-muted-foreground text-lg">
                Join thousands of users who trust Cifra with their most
                important files.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className="px-8">
                <Link href="/auth">Start Free Today</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg font-bold">
                C
              </div>
              <span className="font-semibold">Cifra</span>
            </div>
            <div className="text-muted-foreground text-sm">
              © 2025 Cifra. Built with security in mind.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
