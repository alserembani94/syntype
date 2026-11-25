import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('image ports', 'property'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/**
 * A YAML file format, recognised by its shape. Stands in for the schema-based
 * completion VS Code gets from the YAML extension and SchemaStore: the
 * format's keys, plus some common values.
 */
const format = (name: string, detect: RegExp, keys: string, values = ''): VocabularyPack => ({
  name,
  detect,
  globals: [...items(keys, 'property'), ...items(values, 'enumMember')],
})

export const packs: VocabularyPack[] = [
  format(
    'GitHub Actions',
    /^jobs:/m,
    'name on push pull_request workflow_dispatch schedule branches tags paths jobs runs-on steps uses with run env strategy matrix needs if permissions outputs timeout-minutes',
    'ubuntu-latest macos-latest windows-latest',
  ),
  format(
    'Docker Compose',
    /^services:/m,
    'services image build context dockerfile ports volumes environment env_file depends_on restart networks command healthcheck test interval',
    'always unless-stopped',
  ),
  format(
    'Kubernetes',
    /^apiVersion:/m,
    'apiVersion kind metadata name namespace labels annotations spec replicas selector matchLabels template containers image ports containerPort env value resources limits requests cpu memory type targetPort port rules host http paths path pathType backend service number',
    'Deployment Service Ingress ConfigMap Secret ClusterIP NodePort LoadBalancer Prefix Exact',
  ),
  format(
    'GitLab CI',
    /^stages:/m,
    'stages variables stage image script before_script after_script cache paths artifacts only except when rules needs',
    'manual always on_success',
  ),
  format(
    'OpenAPI',
    /^(?:openapi|components):/m,
    'openapi info title version paths components schemas type properties required items description nullable format enum example',
    'object array string integer number boolean',
  ),
  format(
    'Ansible',
    /^- (?:name|hosts):/m,
    'name hosts become tasks vars handlers notify apt service copy template state enabled',
    'present absent started stopped restarted',
  ),
]
