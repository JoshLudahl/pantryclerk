<script lang="ts">
  export let form: any;
  // Simple client-side helpers for dynamic social rows
  type SocialRow = { platform: string; handle: string };
  let socialRows: SocialRow[] = [{ platform: '', handle: '' }];

  function addSocialRow() {
    socialRows = [...socialRows, { platform: '', handle: '' }];
  }
  function removeSocialRow(index: number) {
    if (socialRows.length <= 1) {
      // keep at least one row
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
</script>

<section class="section">
  <div class="container">
    <h1 class="title">Add Business</h1>
    <p class="subtitle">Create a new entry using the Business model</p>

    {#if form?.success}
      <div class="notification is-success">
        <strong>Saved!</strong> Your business was added with id {form.id}.
      </div>
    {/if}

    {#if form?.errors?.form}
      <div class="notification is-danger">
        {form.errors.form}
      </div>
    {/if}

    <form method="POST" action="?/create">
      <div class="columns is-multiline">
        <div class="column is-full">
          <div class="field">
            <label class="label" for="name">Name *</label>
            <div class="control">
              <input class="input" id="name" name="name" required maxlength="200" />
            </div>
            {#if form?.errors?.name}<p class="help is-danger">{form.errors.name}</p>{/if}
          </div>
        </div>

        <div class="column is-half">
          <div class="field">
            <label class="label" for="type">Type</label>
            <div class="control">
              <input class="input" id="type" name="type" placeholder="e.g., pantry, clinic, restaurant" maxlength="100" />
            </div>
          </div>
        </div>
        <div class="column is-half">
          <div class="field">
            <label class="label" for="phone">Phone</label>
            <div class="control">
              <input class="input" id="phone" name="phone" placeholder="e.g., 503-555-1234" maxlength="50" />
            </div>
          </div>
        </div>

        <div class="column is-full">
          <div class="field">
            <label class="label" for="offering">Offering *</label>
            <div class="control">
              <textarea class="textarea" id="offering" name="offering" required rows="3" maxlength="2000" placeholder="Describe what is being offered"></textarea>
            </div>
            {#if form?.errors?.offering}<p class="help is-danger">{form.errors.offering}</p>{/if}
          </div>
        </div>

        <div class="column is-full">
          <div class="field">
            <label class="label" for="availability">Availability</label>
            <div class="control">
              <textarea class="textarea" id="availability" name="availability" rows="2" maxlength="1000" placeholder="e.g., Every Thursday 10am - 2pm"></textarea>
            </div>
          </div>
        </div>

        <div class="column is-full">
          <div class="field">
            <label class="label" for="address">Address *</label>
            <div class="control">
              <input class="input" id="address" name="address" required maxlength="300" placeholder="123 Main St, Portland, OR 97201" />
            </div>
            {#if form?.errors?.address}<p class="help is-danger">{form.errors.address}</p>{/if}
          </div>
        </div>

        <div class="column is-one-third">
          <div class="field">
            <label class="label" for="zip">ZIP</label>
            <div class="control">
              <input class="input" id="zip" name="zip" inputmode="numeric" maxlength="5" placeholder="97201" on:input={onZipInput} />
            </div>
            <p class="help">If left empty, ZIP will be extracted from the address.</p>
          </div>
        </div>

        <div class="column is-one-third">
          <div class="field">
            <label class="label" for="url">Website</label>
            <div class="control">
              <input class="input" id="url" name="url" type="url" placeholder="https://example.org" />
            </div>
          </div>
        </div>

        <div class="column is-one-third">
          <div class="field">
            <label class="label" for="mapUrl">Map URL</label>
            <div class="control">
              <input class="input" id="mapUrl" name="mapUrl" type="url" placeholder="https://maps.google.com/?q=..." />
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
              <button class="button is-primary" type="submit" name="/create">
                Save
              </button>
            </div>
            <div class="control">
              <a href="/" class="button is-light">Back to list</a>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</section>
