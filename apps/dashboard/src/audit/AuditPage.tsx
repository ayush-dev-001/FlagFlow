import { useSearchParams } from 'react-router';
import { useMembers } from '../api/queries';
import { PageHeader } from '../shell/PageHeader';
import { Panel, Select } from '../ui/kit';
import { AuditList } from './AuditList';

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const actorId = params.get('actor') ?? '';
  const members = useMembers();

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every change in your organization: who made it, and when. Entries can't be edited or removed."
      />
      <Panel
        title="Activity"
        actions={
          <div className="w-full sm:w-56">
            <Select
              label="Changes by"
              hideLabel
              value={actorId}
              onChange={(e) => setParams(e.target.value ? { actor: e.target.value } : {})}
              className="w-full"
            >
              <option value="">Everyone</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        }
        bodyClassName="px-5 py-2 sm:px-6"
      >
        <AuditList
          key={actorId}
          filters={actorId ? { actorId } : {}}
          emptyText={
            actorId ? 'This person hasn’t changed anything yet.' : 'Changes show up here as they happen.'
          }
        />
      </Panel>
    </>
  );
}
