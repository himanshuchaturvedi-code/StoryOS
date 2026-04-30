'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@/lib/api-client';
import { useTenant } from '@/contexts/tenant-context';
import { usePersons } from '@/hooks/use-persons';
import { Button, Card, CardContent, CardHeader, Input } from '@storyos/ui';
import { CanadianProvinceSelect } from '@/components/canadian-province-select';

export default function PersonsPage() {
  const { currentOrgId } = useTenant();
  const { persons, isLoading, error, refetch } = usePersons(currentOrgId);

  const [showForm, setShowForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [citizenship, setCitizenship] = useState('');
  const [city, setCity] = useState('');
  const [provinceState, setProvinceState] = useState('');
  const [country, setCountry] = useState('CA');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/persons', {
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        citizenship: citizenship || undefined,
        city: city || undefined,
        provinceState: provinceState || undefined,
        country: country || undefined,
      });
      await refetch();
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCitizenship('');
      setCity('');
      setProvinceState('');
      setCountry('CA');
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to create person');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!currentOrgId) {
    return <p className="text-sm text-gray-500">Select an organization to manage persons.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Persons</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'Add person'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <h2 className="font-medium text-gray-900">New person</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Input
                  label="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Input
                label="Citizenship (ISO 2-letter, e.g. CA)"
                value={citizenship}
                onChange={(e) => setCitizenship(e.target.value.toUpperCase())}
                maxLength={2}
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                {country === 'CA' ? (
                  <CanadianProvinceSelect value={provinceState} onChange={setProvinceState} />
                ) : (
                  <Input
                    label="Province / State"
                    value={provinceState}
                    onChange={(e) => setProvinceState(e.target.value)}
                    maxLength={10}
                  />
                )}
                <Input
                  label="Country (ISO)"
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  maxLength={2}
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save person'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading persons…</p>
      ) : persons.length === 0 ? (
        <p className="text-sm text-gray-500">No persons added yet. Add one to get started.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Citizenship</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {persons.map((person) => (
                <tr key={person.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/persons/${person.id}`}
                      className="hover:text-brand-600"
                    >
                      {person.lastName}, {person.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{person.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{person.citizenship ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {[person.city, person.provinceState, person.country]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
