<script lang="ts">
  export let data: {
    item: {
      id: number;
      name: string;
      phone: string;
      address: string;
      mapUrl: string;
      offering: string;
      availability: string;
      zip: string;
      url: string;
      type: string;
      social: Array<{ platform?: string; url?: string; label?: string }>;
    };
  };
  export let form: any;

  const { item } = data;

  type SocialRow = { platform: string; handle: string };
  let socialRows: SocialRow[] = (item.social && item.social.length
    ? item.social.map((s) => ({ platform: (s.platform ?? ''), handle: (s.url ?? s.label ?? '') }))
    : [{ platform: '', handle: '' }]) as SocialRow[];

  function addSocialRow() {
    socialRows = [...socialRows, { platform: '', handle: '' }];
  }
  function removeSocialRow(index: number) {
    if (socialRows.length <= 1) {
      socialRows = [{ platform: '', handle: '' }];
      return;
    }
    socialRows = socialRows.filter((_, i) => i !== index);
  }

  // ZIP input sanitization: allow only digits, cap at 5
  function sanitizeZipInput(v: string): string {
    return v.replace(/\D/g, '').slice(0, 5);
  }
  function onZipInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const next = sanitizeZipInput(el.value ?? '');
    if (el.value !== next) el.value = next;
  }

  function onDeleteSubmit(event: SubmitEvent) {
    event.preventDefault();
    const ok = confirm('Are you sure you want to delete this record? This cannot be undone.');
    if (ok) (event.target as HTMLFormElement).submit();
  }
</script>

<section class="section">
  <div class="container">
    <h1 class="title">Edit Business</h1>
    <p class="subtitle">Update or delete this entry</p>

    {#if form?.errors?.form}
      <div class="notification is-danger">{form.errors.form}</div>
    {/if}

    <form method="POST" action="?/update">
      <div class="columns is-multiline">
        <div class="column is-full">
          <div class="field">
            <label class="label" for="name">Name *</label>
            <div class="control">
              <input class="input" id="name" name="name" required maxlength="200" value={item.name} />
            </div>
            {#if form?.errors?.name}<p class="help is-danger">{form.errors.name}</p>{/if}
          </div>
        </div>

        <div class="column is-half">
          <div class="field">
            <label class="label" for="type">Type</label>
            <div class="control">
              <input class="input" id="type" name="type" maxlength="100" value={item.type} />
            </div>
          </div>
        </div>
        <div class="column is-half">
          <div class="field">
            <label class="label" for="phone">Phone</label>
            <div class="control">
              <input class="input" id="phone" name="phone" maxlength="50" value={item.phone} />
            </div>
          </div>
        </div>

        <div class="column is-full">
          <div class="field">
            <label class="label" for="offering">Offering *</label>
            <div class="control">
              <textarea class="textarea" id="offering" name="offering" required rows="3" maxlength="2000">{item.offering}</textarea>
            </div>
            {#if form?.errors?.offering}<p class="help is-danger">{form.errors.offering}</p>{/if}
          </div>
        </div>

        <div class="column is-full">
          <div class="field">
            <label class="label" for="availability">Availability</label>
            <div class="control">
              <textarea class="textarea" id="availability" name="availability" rows="2" maxlength="1000">{item.availability}</textarea>
            </div>
          </div>
        </div>

        <div class="column is-full">
          <div class="field">
            <label class="label" for="address">Address *</label>
            <div class="control">
              <input class="input" id="address" name="address" required maxlength="300" value={item.address} />
            </div>
            {#if form?.errors?.address}<p class="help is-danger">{form.errors.address}</p>{/if}
          </div>
        </div>

        <div class="column is-one-third">
          <div class="field">
            <label class="label" for="zip">ZIP</label>
            <div class="control">
              <input class="input" id="zip" name="zip" inputmode="numeric" maxlength="5" value={item.zip} placeholder="97201" on:input={onZipInput} />
            </div>
            <p class="help">If left empty, ZIP will be extracted from the address.</p>
          </div>
        </div>

        <div class="column is-one-third">
          <div class="field">
            <label class="label" for="url">Website</label>
            <div class="control">
              <input class="input" id="url" name="url" type="url" value={item.url} />
            </div>
          </div>
        </div>

        <div class="column is-one-third">
          <div class="field">
            <label class="label" for="mapUrl">Map URL</label>
            <div class="control">
              <input class="input" id="mapUrl" name="mapUrl" type="url" value={item.mapUrl} />
            </div>
            <p class="help">If left empty, a Google Maps link will be built from the address.</p>
          </div>
        </div>

        <div class="column is-full">
          <div class="field">
            <label class="label">Social</label>

            {#each socialRows as row, i}
              <div class="columns is-mobile is-vcentered mb-2" role="group" aria-label={`Social row ${i + 1}`}>
                <div class="column is-4">
                  <div class="field">
                    <label class="label is-small" for={`social_platform_${i}`}>Platform</label>
                    <div class="control">
                      <input
                        class="input"
                        list="socialPlatformSuggestions"
                        id={`social_platform_${i}`}
                        name="social_platform"
                        placeholder="e.g., Facebook, Instagram, X"
                        bind:value={row.platform}
                      />
                      <datalist id="socialPlatformSuggestions">
                        <option value="Facebook" />
                        <option value="Instagram" />
                        <option value="Twitter" />
                        <option value="X" />
                        <option value="TikTok" />
                        <option value="LinkedIn" />
                        <option value="YouTube" />
                      </datalist>
                    </div>
                  </div>
                </div>
                <div class="column is-7">
                  <div class="field">
                    <label class="label is-small" for={`social_handle_${i}`}>Handle or URL</label>
                    <div class="control">
                      <input
                        class="input"
                        id={`social_handle_${i}`}
                        name="social_handle"
                        placeholder="@handle, handle, or https://..."
                        bind:value={row.handle}
                      />
                    </div>
                    <p class="help">Enter either a full URL or the handle. We'll build the link.</p>
                  </div>
                </div>
                <div class="column is-1 has-text-right">
                  <button class="button is-light is-small" type="button" on:click={() => removeSocialRow(i)} aria-label="Remove social row">✕</button>
                </div>
              </div>
            {/each}

            <div class="field">
              <button class="button is-link is-light is-small" type="button" on:click={addSocialRow}>+ Add another</button>
            </div>

            {#if form?.errors?.social}<p class="help is-danger">{form.errors.social}</p>{/if}
          </div>
        </div>

        <div class="column is-full">
          <div class="field is-grouped">
            <div class="control">
              <button class="button is-primary" type="submit" name="/update">Save changes</button>
            </div>
            <div class="control">
              <a href="/" class="button is-light">Back to list</a>
            </div>
          </div>
        </div>
      </div>
    </form>

    <hr />

    <form method="POST" action="?/delete" on:submit={onDeleteSubmit}>
      <div class="field">
        <button class="button is-danger" type="submit">Delete this record</button>
      </div>
    </form>
  </div>
</section>
