import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';

const INVITATION_EXPIRY_DAYS = 7;
const MAX_PENDING_PER_ORG = 50;

/**
 * Manages the invitation lifecycle.
 *
 * Org-scoped methods (create, list, revoke) receive orgId and userId
 * as explicit parameters — the controller extracts them from TenantContext.
 *
 * Public methods (verify, accept) receive only the token.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async create(orgId: string, invitedById: string, dto: CreateInvitationDto) {
    const email = dto.email.toLowerCase();

    const existingMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId: orgId, user: { email }, deletedAt: null },
    });
    if (existingMember) {
      throw new ConflictException('This user is already a member of the organization');
    }

    // Revoke any existing pending invitation for the same email + org
    await this.prisma.invitation.updateMany({
      where: { organizationId: orgId, email, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });

    const pendingCount = await this.prisma.invitation.count({
      where: { organizationId: orgId, status: 'PENDING' },
    });
    if (pendingCount >= MAX_PENDING_PER_ORG) {
      throw new BadRequestException(
        `Maximum of ${MAX_PENDING_PER_ORG} pending invitations per organization`,
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        email,
        role: (dto.role as any) ?? 'MEMBER',
        invitedById,
        expiresAt,
      },
      include: {
        organization: { select: { name: true } },
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      organizationName: invitation.organization.name,
    };
  }

  async listForOrg(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId: orgId, status: 'PENDING' },
      include: {
        invitedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(orgId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId, status: 'PENDING' },
    });

    if (!invitation) throw new NotFoundException('Invitation not found or already processed');

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });
  }

  /** Public — verifies token and returns display info for the accept page. */
  async verify(token: string) {
    const invitation = await this.findValidInvitation(token);

    return {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Public — accepts an invitation.
   * Creates the user if they don't exist, adds them to the org, returns a JWT.
   */
  async accept(dto: AcceptInvitationDto) {
    const invitation = await this.findValidInvitation(dto.token);

    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email, deletedAt: null },
    });

    if (!user) {
      if (!dto.firstName || !dto.lastName || !dto.password) {
        throw new BadRequestException(
          'firstName, lastName, and password are required for new users',
        );
      }

      user = await this.authService.createUserFromInvitation(
        invitation.email,
        dto.firstName,
        dto.lastName,
        dto.password,
      );
    }

    // Idempotent — skip if already a member
    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: invitation.organizationId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!existingMember) {
      await this.prisma.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        },
      });
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    const accessToken = this.authService.signToken(user.id, user.email);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      organization: {
        id: invitation.organizationId,
        name: invitation.organization.name,
      },
    };
  }

  private async findValidInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!invitation) throw new NotFoundException('Invitation not found');

    if (invitation.status !== 'PENDING') {
      throw new GoneException(`Invitation has already been ${invitation.status.toLowerCase()}`);
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new GoneException('Invitation has expired');
    }

    return invitation;
  }
}
