import { AddWhitelistForm } from "./AddWhitelistForm";
import { WhitelistDisplay } from "./WhitelistDisplay";

interface WhitelistManagementProps {
  whitelist: string[];
}

export function WhitelistManagement({ whitelist }: WhitelistManagementProps) {
  return (
    <div class="card bg-base-100 shadow-md">
      <div class="card-body">
        <h2 class="card-title text-2xl mb-4">Whitelist Management</h2>

        <AddWhitelistForm />
        <WhitelistDisplay whitelist={whitelist} />
      </div>
    </div>
  );
}
