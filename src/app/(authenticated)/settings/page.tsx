// import { authClient } from "@/lib/auth-client";
import { BotIcon, UserIcon } from "lucide-react";

import { AccountForm } from "@/components/settings-acount-form";
import { SettingsPasskey } from "@/components/settings-passkey";
// import { SettingsTOTP } from "@/components/settings-totp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, HydrateClient, prefetch } from "@/trpc/server";

export default function SettingsPage() {
  // const session = await authClient.getSession();

  prefetch(api.passkey.getPasskeys.queryOptions());
  prefetch(api.profile.getProfile.queryOptions());

  return (
    <HydrateClient>
      <Tabs
        defaultValue="tab-1"
        orientation="vertical"
        className="w-full flex-row"
      >
        <TabsList className="text-foreground flex-col gap-1 rounded-none bg-transparent px-1 py-0">
          <TabsTrigger
            value="tab-1"
            className="hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative w-full justify-start after:absolute after:inset-y-0 after:start-0 after:-ms-1 after:w-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <UserIcon
              className="-ms-0.5 me-1.5 opacity-60"
              size={16}
              aria-hidden="true"
            />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="tab-2"
            className="hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative w-full justify-start after:absolute after:inset-y-0 after:start-0 after:-ms-1 after:w-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <BotIcon
              className="-ms-0.5 me-1.5 opacity-60"
              size={16}
              aria-hidden="true"
            />
            Passkeys
          </TabsTrigger>
          <TabsTrigger
            value="tab-3"
            className="hover:bg-accent hover:text-foreground data-[state=active]:after:bg-primary data-[state=active]:hover:bg-accent relative w-full justify-start after:absolute after:inset-y-0 after:start-0 after:-ms-1 after:w-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <BotIcon
              className="-ms-0.5 me-1.5 opacity-60"
              size={16}
              aria-hidden="true"
            />
            TOTP
          </TabsTrigger>
        </TabsList>
        <div className="grow rounded-md text-start">
          <TabsContent value="tab-1">
            <AccountForm />
          </TabsContent>
          <TabsContent value="tab-2">
            <SettingsPasskey />
          </TabsContent>
          <TabsContent value="tab-3">
            <p>Work in progress</p>
          </TabsContent>
        </div>
      </Tabs>
    </HydrateClient>
  );
}
