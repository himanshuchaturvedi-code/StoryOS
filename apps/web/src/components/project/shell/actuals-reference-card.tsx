'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@storyos/ui';

interface ActualsReferenceCardProps {
  title: string;
  description: string;
  links: Array<{
    href: string;
    label: string;
  }>;
}

export function ActualsReferenceCard({
  title,
  description,
  links,
}: ActualsReferenceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
