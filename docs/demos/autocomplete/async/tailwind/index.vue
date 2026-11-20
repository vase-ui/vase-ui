<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';

const searchValue = shallowRef('');
const searchResults = shallowRef<Movie[]>([]);
const error = shallowRef<string | null>(null);
const isPending = shallowRef(false);

const { contains } = Autocomplete.useFilter();

let abortController: AbortController | null = null;

const statusText = computed(() => {
  if (error.value) {
    return error.value;
  }

  if (searchValue.value === '') {
    return null;
  }

  if (searchResults.value.length === 0) {
    return `Movie or year "${searchValue.value}" does not exist in the Top 100 IMDb movies`;
  }

  return `${searchResults.value.length} result${searchResults.value.length === 1 ? '' : 's'} found`;
});

const hasStatus = computed(() => isPending.value || statusText.value !== null);

async function search(nextSearchValue: string) {
  searchValue.value = nextSearchValue;

  const controller = new AbortController();
  abortController?.abort();
  abortController = controller;

  if (nextSearchValue === '') {
    searchResults.value = [];
    error.value = null;
    isPending.value = false;
    return;
  }

  isPending.value = true;
  error.value = null;

  const result = await searchMovies(nextSearchValue, contains);
  if (controller.signal.aborted) {
    return;
  }

  searchResults.value = result.movies;
  error.value = result.error;
  isPending.value = false;
}

async function searchMovies(
  query: string,
  filter: (item: string, query: string) => boolean,
): Promise<{ movies: Movie[]; error: string | null }> {
  // Simulate network delay
  await new Promise((resolve) => {
    setTimeout(resolve, Math.random() * 500 + 100);
  });

  // Simulate occasional network errors (1% chance)
  if (Math.random() < 0.01 || query === 'will_error') {
    return {
      movies: [],
      error: 'Failed to fetch movies. Please try again.',
    };
  }

  const movies = top100Movies.filter(
    (movie) => filter(movie.title, query) || filter(movie.year.toString(), query),
  );

  return {
    movies,
    error: null,
  };
}

interface Movie {
  id: string;
  title: string;
  year: number;
}

const top100Movies: Movie[] = [
  { id: '1', title: 'The Shawshank Redemption', year: 1994 },
  { id: '2', title: 'The Godfather', year: 1972 },
  { id: '3', title: 'The Dark Knight', year: 2008 },
  { id: '4', title: 'The Godfather Part II', year: 1974 },
  { id: '5', title: '12 Angry Men', year: 1957 },
  { id: '6', title: 'The Lord of the Rings: The Return of the King', year: 2003 },
  { id: '7', title: "Schindler's List", year: 1993 },
  { id: '8', title: 'Pulp Fiction', year: 1994 },
  { id: '9', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001 },
  { id: '10', title: 'The Good, the Bad and the Ugly', year: 1966 },
  { id: '11', title: 'Forrest Gump', year: 1994 },
  { id: '12', title: 'The Lord of the Rings: The Two Towers', year: 2002 },
  { id: '13', title: 'Fight Club', year: 1999 },
  { id: '14', title: 'Inception', year: 2010 },
  { id: '15', title: 'Star Wars: Episode V – The Empire Strikes Back', year: 1980 },
  { id: '16', title: 'The Matrix', year: 1999 },
  { id: '17', title: 'Goodfellas', year: 1990 },
  { id: '18', title: 'Interstellar', year: 2014 },
  { id: '19', title: "One Flew Over the Cuckoo's Nest", year: 1975 },
  { id: '20', title: 'Se7en', year: 1995 },
  { id: '21', title: "It's a Wonderful Life", year: 1946 },
  { id: '22', title: 'The Silence of the Lambs', year: 1991 },
  { id: '23', title: 'Seven Samurai', year: 1954 },
  { id: '24', title: 'Saving Private Ryan', year: 1998 },
  { id: '25', title: 'City of God', year: 2002 },
  { id: '26', title: 'Life Is Beautiful', year: 1997 },
  { id: '27', title: 'The Green Mile', year: 1999 },
  { id: '28', title: 'Star Wars: Episode IV – A New Hope', year: 1977 },
  { id: '29', title: 'Terminator 2: Judgment Day', year: 1991 },
  { id: '30', title: 'Back to the Future', year: 1985 },
  { id: '31', title: 'Spirited Away', year: 2001 },
  { id: '32', title: 'The Pianist', year: 2002 },
  { id: '33', title: 'Psycho', year: 1960 },
  { id: '34', title: 'Parasite', year: 2019 },
  { id: '35', title: 'Gladiator', year: 2000 },
  { id: '36', title: 'Léon: The Professional', year: 1994 },
  { id: '37', title: 'American History X', year: 1998 },
  { id: '38', title: 'The Departed', year: 2006 },
  { id: '39', title: 'Whiplash', year: 2014 },
  { id: '40', title: 'The Prestige', year: 2006 },
  { id: '41', title: 'Grave of the Fireflies', year: 1988 },
  { id: '42', title: 'The Usual Suspects', year: 1995 },
  { id: '43', title: 'Casablanca', year: 1942 },
  { id: '44', title: 'Harakiri', year: 1962 },
  { id: '45', title: 'The Lion King', year: 1994 },
  { id: '46', title: 'The Intouchables', year: 2011 },
  { id: '47', title: 'Modern Times', year: 1936 },
  { id: '48', title: 'The Lives of Others', year: 2006 },
  { id: '49', title: 'Once Upon a Time in the West', year: 1968 },
  { id: '50', title: 'Rear Window', year: 1954 },
  { id: '51', title: 'Alien', year: 1979 },
  { id: '52', title: 'City Lights', year: 1931 },
  { id: '53', title: 'The Shining', year: 1980 },
  { id: '54', title: 'Cinema Paradiso', year: 1988 },
  { id: '55', title: 'Avengers: Infinity War', year: 2018 },
  { id: '56', title: 'Paths of Glory', year: 1957 },
  { id: '57', title: 'Django Unchained', year: 2012 },
  { id: '58', title: 'WALL·E', year: 2008 },
  { id: '59', title: 'Sunset Boulevard', year: 1950 },
  { id: '60', title: 'The Great Dictator', year: 1940 },
  { id: '61', title: 'The Dark Knight Rises', year: 2012 },
  { id: '62', title: 'Princess Mononoke', year: 1997 },
  { id: '63', title: 'Witness for the Prosecution', year: 1957 },
  { id: '64', title: 'Oldboy', year: 2003 },
  { id: '65', title: 'Aliens', year: 1986 },
  { id: '66', title: 'Once Upon a Time in America', year: 1984 },
  { id: '67', title: 'Coco', year: 2017 },
  { id: '68', title: 'Your Name.', year: 2016 },
  { id: '69', title: 'American Beauty', year: 1999 },
  { id: '70', title: 'Braveheart', year: 1995 },
  { id: '71', title: 'Das Boot', year: 1981 },
  { id: '72', title: '3 Idiots', year: 2009 },
  { id: '73', title: 'Toy Story', year: 1995 },
  { id: '74', title: 'Inglourious Basterds', year: 2009 },
  { id: '75', title: 'High and Low', year: 1963 },
  { id: '76', title: 'Amadeus', year: 1984 },
  { id: '77', title: 'Good Will Hunting', year: 1997 },
  { id: '78', title: 'Star Wars: Episode VI – Return of the Jedi', year: 1983 },
  { id: '79', title: 'The Hunt', year: 2012 },
  { id: '80', title: 'Capharnaüm', year: 2018 },
  { id: '81', title: 'Reservoir Dogs', year: 1992 },
  { id: '82', title: 'Eternal Sunshine of the Spotless Mind', year: 2004 },
  { id: '83', title: 'Requiem for a Dream', year: 2000 },
  { id: '84', title: 'Come and See', year: 1985 },
  { id: '85', title: 'Ikiru', year: 1952 },
  { id: '86', title: 'Vertigo', year: 1958 },
  { id: '87', title: 'Lawrence of Arabia', year: 1962 },
  { id: '88', title: 'Citizen Kane', year: 1941 },
  { id: '89', title: 'Memento', year: 2000 },
  { id: '90', title: 'North by Northwest', year: 1959 },
  { id: '91', title: 'Star Wars: Episode III – Revenge of the Sith', year: 2005 },
  { id: '92', title: '2001: A Space Odyssey', year: 1968 },
  { id: '93', title: 'Amélie', year: 2001 },
  { id: '94', title: "Singin' in the Rain", year: 1952 },
  { id: '95', title: 'Apocalypse Now', year: 1979 },
  { id: '96', title: 'Taxi Driver', year: 1976 },
  { id: '97', title: 'Downfall', year: 2004 },
  { id: '98', title: 'The Wolf of Wall Street', year: 2013 },
  { id: '99', title: 'A Clockwork Orange', year: 1971 },
  { id: '100', title: 'Double Indemnity', year: 1944 },
];
</script>

<template>
  <Autocomplete.Root
    :items="searchResults"
    :model-value="searchValue"
    :item-to-string-value="(item: Movie) => item.title"
    :filter="null"
    @value-change="search"
  >
    <label class="flex flex-col gap-1 text-sm font-bold text-neutral-950 dark:text-white">
      Search movies by name or year
      <Autocomplete.Input
        placeholder="e.g. Pulp Fiction or 1994"
        class="h-8 w-[16rem] border border-neutral-950 bg-white dark:bg-neutral-950 px-2 text-sm any-pointer-coarse:text-base font-normal text-neutral-950 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 dark:focus:outline-white dark:border-white dark:text-white"
      />
    </label>

    <Autocomplete.Portal>
      <Autocomplete.Positioner
        :hidden="!hasStatus"
        class="outline-hidden"
        :side-offset="4"
        align="start"
      >
        <Autocomplete.Popup
          class="w-[var(--anchor-width)] max-w-[var(--available-width)] border border-neutral-950 bg-white text-neutral-950 shadow-[0.25rem_0.25rem_0] shadow-black/12 dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-none"
          :aria-busy="isPending || undefined"
        >
          <div
            class="max-h-[min(var(--available-height),22.5rem)] overflow-y-auto overscroll-contain py-1 scroll-pt-1 scroll-pb-1"
          >
            <Autocomplete.Status>
              <div
                v-if="hasStatus"
                class="flex items-center gap-2 py-1 pr-8 pl-2 text-sm text-neutral-500 dark:text-neutral-400"
              >
                <template v-if="isPending">
                  <span
                    class="inline-block size-3 animate-spin rounded-full border border-current border-r-transparent rtl:border-r-current rtl:border-l-transparent"
                    aria-hidden="true"
                  />
                  Searching…
                </template>
                <template v-else>{{ statusText }}</template>
              </div>
            </Autocomplete.Status>
            <Autocomplete.List>
              <template #item="{ item }">
                <Autocomplete.Item
                  class="group flex cursor-default py-2 pr-2 pl-2 text-sm leading-4 outline-hidden select-none data-highlighted:relative data-highlighted:z-0 data-highlighted:text-white data-highlighted:before:absolute data-highlighted:before:inset-x-0 data-highlighted:before:inset-y-0 data-highlighted:before:z-[-1] data-highlighted:before:bg-neutral-950 dark:data-highlighted:text-neutral-950 dark:data-highlighted:before:bg-white"
                  :value="item"
                >
                  <span class="flex w-full flex-col gap-1">
                    <span class="font-bold leading-5">{{ item.title }}</span>
                    <span
                      class="text-sm leading-4 text-neutral-500 dark:text-neutral-400 group-data-highlighted:text-neutral-300 dark:group-data-highlighted:text-neutral-500"
                      >{{ item.year }}</span
                    >
                  </span>
                </Autocomplete.Item>
              </template>
            </Autocomplete.List>
          </div>
        </Autocomplete.Popup>
      </Autocomplete.Positioner>
    </Autocomplete.Portal>
  </Autocomplete.Root>
</template>
