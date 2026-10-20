import { handleAddressSearch } from "../server/address-search.js";

export default async function addressSearch(request, response) {
  return handleAddressSearch(request, response);
}
