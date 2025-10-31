<script lang="ts">
  export let data: { items: Array<{
    id: number;
    name: string;
    phone?: string;
    address: string;
    mapUrl: string;
    offering: string;
    availability?: string;
    zip?: number;
    url?: string;
    social?: Array<{ platform?: string; url?: string; label?: string }>;
    type?: string;
  }>; };
  const { items } = data;

  let selectedZip: string = 'all';
  let selectedType: string = 'all';
  let typedZip: string = '';
  let sortOrder: 'asc' | 'desc' = 'asc';

  function sanitizeZipInput(v: string): string {
    return v.replace(/\D/g, '').slice(0, 5);
  }
  function onTypedZipInput(e: Event) {
    const target = e.target as HTMLInputElement;
    typedZip = sanitizeZipInput(target.value ?? '');
  }

  function formatZip(n?: number): string {
    return typeof n === 'number' && Number.isFinite(n) ? String(n).padStart(5, '0') : '';
  }

  $: uniqueTypes = Array.from(new Set(items.map((i) => i.type).filter((t): t is string => !!t))).sort((a, b) => a.localeCompare(b));
  $: uniqueZips = Array.from(new Set(items.map((i) => formatZip(i.zip)).filter((z): z is string => !!z))).sort();

  // Apply filters: first by Type, then by ZIP (typed prefix takes precedence over dropdown)
  $: byType = selectedType === 'all' ? items : items.filter((i) => (i.type ?? '') === selectedType);
  $: filtered = typedZip.length > 0
    ? byType.filter((i) => formatZip(i.zip).startsWith(typedZip))
    : (selectedZip === 'all' ? byType : byType.filter((i) => formatZip(i.zip) === selectedZip));

  $: filteredAndSorted = [...filtered].sort((a, b) => {
    const az = a.zip ?? -1;
    const bz = b.zip ?? -1;
    if (az === bz) return 0;
    return sortOrder === 'asc' ? (az - bz) : (bz - az);
  });

  // Build empty-state helper text based on active filters
  $: activeZipText = typedZip.length > 0
    ? `ZIP starting with ${typedZip}`
    : (selectedZip !== 'all' ? `ZIP ${selectedZip}` : '');
  $: activeTypeText = selectedType !== 'all' ? `type "${selectedType}"` : '';

  function resetFilters() {
    selectedZip = 'all';
    selectedType = 'all';
    typedZip = '';
    sortOrder = 'asc';
  }
</script>

<section class="section">
  <div class="container">
    <h1 class="title">Community Offerings</h1>
    <p class="subtitle">Local businesses and organizations that are providing help</p>

    <!-- Controls -->
    <div class="box" aria-label="Filter and sort controls">
      <div class="columns is-variable is-2 is-vcentered is-multiline">
        <div class="column is-full-mobile is-half-tablet is-one-quarter-desktop">
          <div class="field">
            <label class="label" for="typeSelect">Type</label>
            <div class="control">
              <div class="select is-fullwidth">
                <select id="typeSelect" bind:value={selectedType} aria-label="Filter by type">
                  <option value="all">All types</option>
                  {#if uniqueTypes.length}
                    {#each uniqueTypes as t}
                      <option value={t}>{t}</option>
                    {/each}
                  {/if}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="column is-full-mobile is-half-tablet is-one-quarter-desktop">
          <div class="field">
            <label class="label" for="zipInput">Type ZIP</label>
            <div class="control has-icons-left">
              <input
                id="zipInput"
                class="input"
                type="text"
                bind:value={typedZip}
                on:input={onTypedZipInput}
                inputmode="numeric"
                pattern="\d*"
                maxlength="5"
                placeholder="Type ZIP (e.g., 97222)"
                aria-label="Type ZIP code to filter"
                list="zipSuggestions"
              />
              <span class="icon is-small is-left">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              </span>
              <datalist id="zipSuggestions">
                {#each uniqueZips as z}
                  <option value={z}></option>
                {/each}
              </datalist>

            </div>
          </div>
        </div>
        <div class="column is-full-mobile is-half-tablet is-one-quarter-desktop">
          <div class="field">
            <label class="label" for="zipSelect">ZIP code</label>
            <div class="control">
              <div class="select is-fullwidth">
                <select id="zipSelect" bind:value={selectedZip} aria-label="Filter by ZIP code">
                  <option value="all">All ZIP codes</option>
                  {#each uniqueZips as z}
                    <option value={z}>{z}</option>
                  {/each}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="column is-full-mobile is-half-tablet is-one-quarter-desktop">
          <div class="field">
            <label class="label" for="sortSelect">Sort by ZIP</label>
            <div class="control">
              <div class="select is-fullwidth">
                <select id="sortSelect" bind:value={sortOrder} aria-label="Sort by ZIP">
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="column is-full-mobile is-half-tablet is-one-quarter-desktop">
          <div class="field">
            <div class="control">
              <button class="button is-light is-fullwidth" on:click={resetFilters} aria-label="Reset filters and sorting">Reset</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {#if filteredAndSorted?.length}
      <div class="columns is-multiline">
        {#each filteredAndSorted as item}
          <div class="column is-full-tablet is-half-desktop">
            <article class="card">
              <header class="card-header">
                <p class="card-header-title is-justify-content-space-between is-align-items-center">
                  <span>{item.name}</span>
                  {#if item.type}
                    <span class="tag is-info is-light" aria-label="Type">{item.type}</span>
                  {/if}
                </p>
                <div class="card-header-icon">
                  <a class="button is-small is-light" href={`/business/${item.id}/edit`} aria-label={`Edit ${item.name}`}>Edit</a>
                </div>
              </header>
              <div class="card-content">
                <div class="content">
                  <p>
                    <strong>Offering:</strong>
                    <br />{item.offering}
                  </p>
                  {#if item.availability}
                    <p>
                      <strong>Availability:</strong>
                      <br />{item.availability}
                    </p>
                  {/if}
                  <p>
                    <strong>Address:</strong>
                    <br />{item.address}
                  </p>
                  {#if item.zip != null}
                    <p>
                      <strong>ZIP:</strong>
                      <br />{formatZip(item.zip)}
                    </p>
                  {/if}
                  {#if item.phone}
                    <p>
                      <strong>Phone:</strong>
                      <br /><a href={`tel:${item.phone}`}>{item.phone}</a>
                    </p>
                  {/if}
                  {#if item.url}
                    <p>
                      <strong>Website:</strong>
                      <br />
                      <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Open website for ${item.name}`}>
                        Visit website
                      </a>
                    </p>
                  {/if}
                  {#if item.social?.length}
                    <p>
                      <strong>Social:</strong>
                    </p>
                    <div class="tags">
                      {#each item.social as s}
                        {#if s.url}
                          <a
                            class="tag is-link is-light"
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${s.platform ?? 'social profile'} for ${item.name}`}
                          >
                            {s.platform ?? 'Profile'}
                          </a>
                        {:else if s.label}
                          <span class="tag">{s.label}</span>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
              <footer class="card-footer">
                <a class="card-footer-item" href={item.mapUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open map for ${item.name}`}> 
                  View on Map
                </a>
              </footer>
            </article>
          </div>
        {/each}
      </div>
    {:else}
      <div class="notification is-warning is-light">
        <p><strong>Nothing found</strong>{#if activeTypeText || activeZipText} for {activeTypeText}{#if activeTypeText && activeZipText} and {/if}{activeZipText}{/if}.</p>
        <p>Try expanding your search: clear filters, choose “All types”, or broaden the ZIP.</p>
      </div>
    {/if}
  </div>
</section>
