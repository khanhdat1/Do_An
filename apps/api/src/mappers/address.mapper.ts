import type { Address } from "@pczone/db";
import type { AddressDto } from "../types/dto.js";

export function toAddressDto(address: Address): AddressDto {
  return {
    id: address.id,
    recipientName: address.recipientName,
    phone: address.phone,
    province: address.province,
    district: address.district,
    ward: address.ward,
    streetAddress: address.streetAddress,
    note: address.note ?? undefined,
    isDefault: address.isDefault,
  };
}
