import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const PASSWORD_RULE = /^(?=.*[A-Za-zঀ-৿])(?=.*\d).{8,72}$/;

export class PhoneDto {
  @IsString() @MaxLength(20) phone: string;
}

export class OtpRequestDto extends PhoneDto {
  @IsIn(['REGISTER', 'RESET_PASSWORD']) purpose: 'REGISTER' | 'RESET_PASSWORD';
  @IsOptional() @IsIn(['SMS', 'WHATSAPP']) channel?: 'SMS' | 'WHATSAPP';
}

export class RegisterDto extends PhoneDto {
  @Length(6, 6) code: string;
  @IsString() @Length(2, 80) name: string;
  @IsOptional() @IsEmail() email?: string;
  @Matches(PASSWORD_RULE, { message: 'WEAK_PASSWORD' }) password: string;
  @IsOptional() @IsIn(['PERSONAL', 'BUSINESS']) buyerType?: 'PERSONAL' | 'BUSINESS';
}

export class LoginDto extends PhoneDto {
  @IsString() @MaxLength(72) password: string;
}

export class ResetDto extends PhoneDto {
  @Length(6, 6) code: string;
  @Matches(PASSWORD_RULE, { message: 'WEAK_PASSWORD' }) password: string;
}

export class StaffVerifyDto extends PhoneDto {
  @Length(6, 6) code: string;
}
