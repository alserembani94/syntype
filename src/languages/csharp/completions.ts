import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('List Dictionary', 'class'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** A namespace beyond the implicit ones, on when the snippet has `using <name>;`. */
function namespace(name: string, globals: CompletionItem[], members: Record<string, CompletionItem[]> = {}): VocabularyPack {
  return { name, detect: new RegExp(`^\\s*using\\s+${name.replace(/\./g, '\\.')}\\s*;`, 'm'), globals, members }
}

/**
 * The implicit usings of a .NET 8 project (System, System.Collections.Generic, System.IO,
 * System.Linq, System.Net.Http, System.Threading, System.Threading.Tasks): always on.
 */
const implicit: VocabularyPack = {
  name: '.NET',
  globals: [
    ...items('Console Math String DateTime DateTimeOffset TimeSpan Guid Convert Environment Random Func Action Nullable', 'class'),
    ...items('List Dictionary HashSet Queue Stack KeyValuePair IEnumerable IEnumerator IList IReadOnlyList IDictionary IReadOnlyDictionary ICollection IComparable IEquatable IDisposable', 'class'),
    ...items('Exception ArgumentException ArgumentNullException ArgumentOutOfRangeException InvalidOperationException NotSupportedException NotImplementedException KeyNotFoundException HttpRequestException OperationCanceledException', 'class'),
    ...items('Task ValueTask CancellationToken CancellationTokenSource File Path Directory StreamReader StreamWriter HttpClient Enumerable StringSplitOptions StringComparison', 'class'),
  ],
  members: {
    Console: items('WriteLine Write ReadLine ReadKey Clear', 'method'),
    Math: [...items('Abs Max Min Round Floor Ceiling Sqrt Pow Clamp Sign', 'method'), ...items('PI E', 'property')],
    string: [...items('Join Concat Format IsNullOrEmpty IsNullOrWhiteSpace Compare', 'method'), ...items('Empty', 'property')],
    String: [...items('Join Concat Format IsNullOrEmpty IsNullOrWhiteSpace Compare', 'method'), ...items('Empty', 'property')],
    DateTime: [...items('Now UtcNow Today MinValue MaxValue', 'property'), ...items('Parse TryParse', 'method')],
    TimeSpan: items('FromMilliseconds FromSeconds FromMinutes FromHours FromDays Zero', 'method'),
    Guid: items('NewGuid Parse Empty', 'method'),
    Task: [...items('Run Delay WhenAll WhenAny FromResult', 'method'), ...items('CompletedTask', 'property')],
    File: items('ReadAllText ReadAllTextAsync ReadAllLines ReadAllLinesAsync WriteAllText WriteAllTextAsync AppendAllText Exists Delete OpenRead', 'method'),
    Path: items('Combine GetFileName GetExtension GetDirectoryName GetTempPath', 'method'),
    Directory: items('Exists CreateDirectory GetFiles EnumerateFiles Delete', 'method'),
    Enumerable: items('Range Repeat Empty', 'method'),
    ArgumentException: items('ThrowIfNullOrEmpty ThrowIfNullOrWhiteSpace', 'method'),
    ArgumentNullException: items('ThrowIfNull', 'method'),
    ArgumentOutOfRangeException: items('ThrowIfNegative ThrowIfZero ThrowIfGreaterThan ThrowIfLessThan', 'method'),
    StringSplitOptions: items('None RemoveEmptyEntries TrimEntries', 'enumMember'),
    // Without a language service the type before "." is unknown, so LINQ and the common
    // collection, string and task members are offered.
    '*': [
      ...items('Where Select SelectMany OrderBy OrderByDescending ThenBy GroupBy Take Skip First FirstOrDefault Single Last Any All Count Sum Average Min Max MinBy MaxBy Distinct ToList ToArray ToDictionary Aggregate Zip Contains', 'method'),
      ...items('Add AddRange Remove RemoveAt Clear Insert IndexOf TryGetValue GetValueOrDefault ContainsKey TryAdd Push Pop Peek Enqueue Dequeue', 'method'),
      ...items('ToString Equals GetHashCode GetType CompareTo Split Trim StartsWith EndsWith Substring Replace ToUpper ToLower PadLeft PadRight', 'method'),
      ...items('GetStringAsync GetAsync PostAsync ConfigureAwait Dispose', 'method'),
      ...items('Length Count Keys Values Value HasValue Message', 'property'),
    ],
  },
}

export const packs: VocabularyPack[] = [
  implicit,
  namespace('System.Text', items('StringBuilder Encoding', 'class'), {
    Encoding: items('UTF8 ASCII Unicode', 'property'),
  }),
  namespace('System.Text.Json', items('JsonSerializer JsonSerializerOptions JsonException', 'class'), {
    JsonSerializer: items('Serialize Deserialize SerializeAsync DeserializeAsync', 'method'),
  }),
  namespace('System.Text.RegularExpressions', items('Regex Match RegexOptions', 'class'), {
    Regex: items('IsMatch Match Matches Replace Split', 'method'),
  }),
  namespace('System.Diagnostics', items('Stopwatch Debug Trace', 'class'), {
    Stopwatch: items('StartNew', 'method'),
  }),
  namespace('System.Collections', items('IEnumerable IEnumerator', 'interface')),
]
