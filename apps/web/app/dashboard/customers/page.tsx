"use client";

import { Mail, MessageSquare, Phone, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  type CustomerChannelFilter,
  useCreateCustomer,
  useDeleteCustomer,
  useCustomers,
} from "@/lib/hooks/use-customers";

const COUNTRY_DIAL_CODES: Array<{ name: string; code: string }> = [
  { name: "Afghanistan", code: "+93" }, { name: "Albania", code: "+355" }, { name: "Algeria", code: "+213" },
  { name: "Andorra", code: "+376" }, { name: "Angola", code: "+244" }, { name: "Antigua and Barbuda", code: "+1-268" },
  { name: "Argentina", code: "+54" }, { name: "Armenia", code: "+374" }, { name: "Australia", code: "+61" },
  { name: "Austria", code: "+43" }, { name: "Azerbaijan", code: "+994" }, { name: "Bahamas", code: "+1-242" },
  { name: "Bahrain", code: "+973" }, { name: "Bangladesh", code: "+880" }, { name: "Barbados", code: "+1-246" },
  { name: "Belarus", code: "+375" }, { name: "Belgium", code: "+32" }, { name: "Belize", code: "+501" },
  { name: "Benin", code: "+229" }, { name: "Bhutan", code: "+975" }, { name: "Bolivia", code: "+591" },
  { name: "Bosnia and Herzegovina", code: "+387" }, { name: "Botswana", code: "+267" }, { name: "Brazil", code: "+55" },
  { name: "Brunei", code: "+673" }, { name: "Bulgaria", code: "+359" }, { name: "Burkina Faso", code: "+226" },
  { name: "Burundi", code: "+257" }, { name: "Cabo Verde", code: "+238" }, { name: "Cambodia", code: "+855" },
  { name: "Cameroon", code: "+237" }, { name: "Canada", code: "+1" }, { name: "Central African Republic", code: "+236" },
  { name: "Chad", code: "+235" }, { name: "Chile", code: "+56" }, { name: "China", code: "+86" },
  { name: "Colombia", code: "+57" }, { name: "Comoros", code: "+269" }, { name: "Congo", code: "+242" },
  { name: "Costa Rica", code: "+506" }, { name: "Croatia", code: "+385" }, { name: "Cuba", code: "+53" },
  { name: "Cyprus", code: "+357" }, { name: "Czech Republic", code: "+420" }, { name: "Denmark", code: "+45" },
  { name: "Djibouti", code: "+253" }, { name: "Dominica", code: "+1-767" }, { name: "Dominican Republic", code: "+1-809" },
  { name: "Ecuador", code: "+593" }, { name: "Egypt", code: "+20" }, { name: "El Salvador", code: "+503" },
  { name: "Equatorial Guinea", code: "+240" }, { name: "Eritrea", code: "+291" }, { name: "Estonia", code: "+372" },
  { name: "Eswatini", code: "+268" }, { name: "Ethiopia", code: "+251" }, { name: "Fiji", code: "+679" },
  { name: "Finland", code: "+358" }, { name: "France", code: "+33" }, { name: "Gabon", code: "+241" },
  { name: "Gambia", code: "+220" }, { name: "Georgia", code: "+995" }, { name: "Germany", code: "+49" },
  { name: "Ghana", code: "+233" }, { name: "Greece", code: "+30" }, { name: "Grenada", code: "+1-473" },
  { name: "Guatemala", code: "+502" }, { name: "Guinea", code: "+224" }, { name: "Guinea-Bissau", code: "+245" },
  { name: "Guyana", code: "+592" }, { name: "Haiti", code: "+509" }, { name: "Honduras", code: "+504" },
  { name: "Hungary", code: "+36" }, { name: "Iceland", code: "+354" }, { name: "India", code: "+91" },
  { name: "Indonesia", code: "+62" }, { name: "Iran", code: "+98" }, { name: "Iraq", code: "+964" },
  { name: "Ireland", code: "+353" }, { name: "Israel", code: "+972" }, { name: "Italy", code: "+39" },
  { name: "Jamaica", code: "+1-876" }, { name: "Japan", code: "+81" }, { name: "Jordan", code: "+962" },
  { name: "Kazakhstan", code: "+7" }, { name: "Kenya", code: "+254" }, { name: "Kiribati", code: "+686" },
  { name: "Kuwait", code: "+965" }, { name: "Kyrgyzstan", code: "+996" }, { name: "Laos", code: "+856" },
  { name: "Latvia", code: "+371" }, { name: "Lebanon", code: "+961" }, { name: "Lesotho", code: "+266" },
  { name: "Liberia", code: "+231" }, { name: "Libya", code: "+218" }, { name: "Liechtenstein", code: "+423" },
  { name: "Lithuania", code: "+370" }, { name: "Luxembourg", code: "+352" }, { name: "Madagascar", code: "+261" },
  { name: "Malawi", code: "+265" }, { name: "Malaysia", code: "+60" }, { name: "Maldives", code: "+960" },
  { name: "Mali", code: "+223" }, { name: "Malta", code: "+356" }, { name: "Marshall Islands", code: "+692" },
  { name: "Mauritania", code: "+222" }, { name: "Mauritius", code: "+230" }, { name: "Mexico", code: "+52" },
  { name: "Micronesia", code: "+691" }, { name: "Moldova", code: "+373" }, { name: "Monaco", code: "+377" },
  { name: "Mongolia", code: "+976" }, { name: "Montenegro", code: "+382" }, { name: "Morocco", code: "+212" },
  { name: "Mozambique", code: "+258" }, { name: "Myanmar", code: "+95" }, { name: "Namibia", code: "+264" },
  { name: "Nauru", code: "+674" }, { name: "Nepal", code: "+977" }, { name: "Netherlands", code: "+31" },
  { name: "New Zealand", code: "+64" }, { name: "Nicaragua", code: "+505" }, { name: "Niger", code: "+227" },
  { name: "Nigeria", code: "+234" }, { name: "North Korea", code: "+850" }, { name: "North Macedonia", code: "+389" },
  { name: "Norway", code: "+47" }, { name: "Oman", code: "+968" }, { name: "Pakistan", code: "+92" },
  { name: "Palau", code: "+680" }, { name: "Panama", code: "+507" }, { name: "Papua New Guinea", code: "+675" },
  { name: "Paraguay", code: "+595" }, { name: "Peru", code: "+51" }, { name: "Philippines", code: "+63" },
  { name: "Poland", code: "+48" }, { name: "Portugal", code: "+351" }, { name: "Qatar", code: "+974" },
  { name: "Romania", code: "+40" }, { name: "Russia", code: "+7" }, { name: "Rwanda", code: "+250" },
  { name: "Saint Kitts and Nevis", code: "+1-869" }, { name: "Saint Lucia", code: "+1-758" },
  { name: "Saint Vincent and the Grenadines", code: "+1-784" }, { name: "Samoa", code: "+685" },
  { name: "San Marino", code: "+378" }, { name: "Sao Tome and Principe", code: "+239" }, { name: "Saudi Arabia", code: "+966" },
  { name: "Senegal", code: "+221" }, { name: "Serbia", code: "+381" }, { name: "Seychelles", code: "+248" },
  { name: "Sierra Leone", code: "+232" }, { name: "Singapore", code: "+65" }, { name: "Slovakia", code: "+421" },
  { name: "Slovenia", code: "+386" }, { name: "Solomon Islands", code: "+677" }, { name: "Somalia", code: "+252" },
  { name: "South Africa", code: "+27" }, { name: "South Korea", code: "+82" }, { name: "South Sudan", code: "+211" },
  { name: "Spain", code: "+34" }, { name: "Sri Lanka", code: "+94" }, { name: "Sudan", code: "+249" },
  { name: "Suriname", code: "+597" }, { name: "Sweden", code: "+46" }, { name: "Switzerland", code: "+41" },
  { name: "Syria", code: "+963" }, { name: "Taiwan", code: "+886" }, { name: "Tajikistan", code: "+992" },
  { name: "Tanzania", code: "+255" }, { name: "Thailand", code: "+66" }, { name: "Timor-Leste", code: "+670" },
  { name: "Togo", code: "+228" }, { name: "Tonga", code: "+676" }, { name: "Trinidad and Tobago", code: "+1-868" },
  { name: "Tunisia", code: "+216" }, { name: "Turkey", code: "+90" }, { name: "Turkmenistan", code: "+993" },
  { name: "Tuvalu", code: "+688" }, { name: "Uganda", code: "+256" }, { name: "Ukraine", code: "+380" },
  { name: "United Arab Emirates", code: "+971" }, { name: "United Kingdom", code: "+44" }, { name: "United States", code: "+1" },
  { name: "Uruguay", code: "+598" }, { name: "Uzbekistan", code: "+998" }, { name: "Vanuatu", code: "+678" },
  { name: "Vatican City", code: "+379" }, { name: "Venezuela", code: "+58" }, { name: "Vietnam", code: "+84" },
  { name: "Yemen", code: "+967" }, { name: "Zambia", code: "+260" }, { name: "Zimbabwe", code: "+263" },
];

function channelBadgeClass(channel: string): string {
  if (channel === "Call") return "bg-blue-100 text-blue-700";
  if (channel === "Email") return "bg-purple-100 text-purple-700";
  if (channel === "SMS") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

export default function CustomersPage(): JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<CustomerChannelFilter>("all");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const customersQuery = useCustomers({ q: query, channel });
  const createCustomerMutation = useCreateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();
  const { showToast } = useToast();
  const customers = customersQuery.data ?? [];

  const stats = useMemo(() => {
    return {
      total: customers.length,
      call: customers.filter((item) => item.calls > 0).length,
      email: customers.filter((item) => item.emails > 0).length,
      sms: customers.filter((item) => item.sms > 0).length,
    };
  }, [customers]);

  async function handleCreateCustomer(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim() || !phone.trim()) {
      return;
    }
    try {
      await createCustomerMutation.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast("Customer saved", "success");
      setName("");
      setPhone("");
      setCountryCode("+1");
      setEmail("");
      setNotes("");
    } catch (error) {
      showToast(getApiErrorMessage(error, "Failed to save customer"), "error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-textPrimary">Customers</h1>
        <p className="text-sm text-textSecondary">
          View customer contact information and how AI agents interacted with them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/80 bg-gradient-to-br from-bgSurface to-bgBase">
          <CardHeader>
            <CardTitle className="text-base">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-textPrimary">{stats.total}</p>
          </CardContent>
        </Card>
        {[
          { label: "Reached by Call", value: stats.call, Icon: Phone },
          { label: "Reached by Email", value: stats.email, Icon: Mail },
          { label: "Reached by SMS", value: stats.sms, Icon: MessageSquare },
        ].map(({ label, value, Icon }) => (
          <Card
            key={label}
            className="border-[#cfe2ff] bg-gradient-to-br from-[#e8f2ff] to-[#f5f9ff] dark:border-border dark:from-[#12243a] dark:to-[#0f1e31]"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-white/80 p-1.5 text-accent dark:bg-[#1a2f46]">
                  <Icon className="h-4 w-4" />
                </span>
                <CardTitle className="text-sm text-textSecondary">{label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-textPrimary">{value}</p>
              <p className="mt-1 text-xs text-textSecondary">contacts reached</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateCustomer}>
            <input
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              placeholder="Full name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="flex overflow-hidden rounded-md border border-border">
              <select
                className="w-28 border-r border-border bg-bgBase px-2 py-2 text-xs"
                value={countryCode}
                onChange={(event) => {
                  const nextCode = event.target.value;
                  setCountryCode(nextCode);
                  const localPart = phone.replace(/^\+\d+\s*/, "");
                  setPhone(`${nextCode} ${localPart}`.trim());
                }}
              >
                {COUNTRY_DIAL_CODES.map((item) => (
                  <option key={`${item.name}-${item.code}`} value={item.code}>
                    {item.name} {item.code}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 bg-bgBase px-3 py-2 text-sm"
                placeholder="Phone"
                value={phone}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw.startsWith("+")) {
                    setPhone(raw);
                  } else {
                    setPhone(`${countryCode} ${raw}`.trim());
                  }
                }}
              />
            </div>
            <input
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              placeholder="Email (optional)"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <div className="md:col-span-2">
              <Button type="submit" disabled={createCustomerMutation.isPending}>
                {createCustomerMutation.isPending ? "Saving..." : "Save Customer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textSecondary" />
              <input
                className="w-full rounded-md border border-border bg-bgBase py-2 pl-9 pr-3 text-sm"
                placeholder="Search by name, number or email"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="rounded-md border border-border bg-bgBase px-3 py-2 text-sm"
              value={channel}
              onChange={(event) => setChannel(event.target.value as CustomerChannelFilter)}
            >
              <option value="all">All channels</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          {customersQuery.isLoading ? (
            <p className="text-sm text-textSecondary">Loading customers...</p>
          ) : null}
          {customersQuery.isError ? (
            <p className="text-sm text-[color:var(--danger)]">Failed to load customers.</p>
          ) : null}

          <div className="-mx-1 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-textSecondary">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Phone</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Preferred Channel</th>
                <th className="py-2 font-medium">Calls</th>
                <th className="py-2 font-medium">Emails</th>
                <th className="py-2 font-medium">SMS</th>
                <th className="py-2 font-medium">Added</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-border/60 hover:bg-bgElevated"
                >
                  <td className="py-3 font-medium text-textPrimary">
                    <span className="inline-flex items-center gap-2">
                      {customer.name}
                      {customer._localOnly ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                          Local
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-3">{customer.phone}</td>
                  <td className="py-3">{customer.email ?? "--"}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${channelBadgeClass(customer.preferred_channel)}`}>
                      {customer.preferred_channel}
                    </span>
                  </td>
                  <td className="py-3">{customer.calls}</td>
                  <td className="py-3">{customer.emails}</td>
                  <td className="py-3">{customer.sms}</td>
                  <td className="py-3">{new Date(customer.created_at).toLocaleDateString()}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/customers/${customer.id}` as never)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await deleteCustomerMutation.mutateAsync(customer.id);
                            showToast("Customer deleted", "success");
                          } catch (error) {
                            showToast(getApiErrorMessage(error, "Failed to delete customer"), "error");
                          }
                        }}
                        disabled={deleteCustomerMutation.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
